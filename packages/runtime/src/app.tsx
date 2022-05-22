import { useContext, useEffect, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'
import { TraverseOptions } from '@babel/traverse'
import * as t from '@babel/types'
import { transform } from '@babel/standalone'
import { detectRootPath, fileToText, fsGetFile, fsWriteToFile } from './fs'
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  useMatches,
  KBarResults,
  useRegisterActions,
  KBarContext,
  VisualState,
} from 'kbar'
import { elementGetAbsolutePosition } from './dom'
import { ElementNavbar } from './navbar'

export function SwipRoot() {
  return (
    <div
      id="swip-root"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    >
      <KBarProvider>
        <SwipApp />
      </KBarProvider>
    </div>
  )
}

function SwipApp() {
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(
    null,
  )

  const kbarContext = useContext(KBarContext)

  // jump
  const jumpToCode = () => {
    if (!selectedElement) {
      return
    }

    const fiber = getReactFiber(selectedElement)
    if (!fiber) {
      return
    }

    const source = fiber._debugSource
    const vscodeLink = makeVscodeLink(source)
    window.open(vscodeLink)
  }

  useEffect(() => {
    ;(window as any).JUMP = jumpToCode
  }, [selectedElement])

  useRegisterActions(
    [
      {
        id: 'jump-to-code',
        name: 'Jump to code',
        shortcut: ['c'],
        keywords: 'jump code',
        section: 'General',
        perform: () => jumpToCode(),
      },
    ],
    [selectedElement],
  )

  const dirHandlerRef = useRef<FileSystemDirectoryHandle | null>(null)

  // read
  useEffect(() => {
    ;(window as any).READ = async () => {
      if (!selectedElement) {
        return
      }

      const fiber = getReactFiber(selectedElement)
      if (!fiber) {
        return
      }

      const source = fiber._debugSource

      const dirHandler = await (async () => {
        const handlerFromRef = dirHandlerRef.current

        if (handlerFromRef) {
          return handlerFromRef
        }

        const handlerFromIdb = (await get(
          'dirHandler',
        )) as FileSystemDirectoryHandle

        if (handlerFromIdb) {
          return handlerFromIdb
        }

        const dirHandler = await window.showDirectoryPicker()
        await set('dirHandler', dirHandler)
        return dirHandler
      })()

      if (
        (await dirHandler.queryPermission({ mode: 'readwrite' })) !== 'granted'
      ) {
        await dirHandler.requestPermission({ mode: 'readwrite' })
        await set('dirHandler', dirHandler)
      }

      const rootPath = await detectRootPath(dirHandler, source.fileName)

      if (!rootPath) {
        return
      }

      const relativePath = source.fileName.replace(rootPath, '')
      const fileHandle = await fsGetFile(dirHandler, relativePath)

      if (!fileHandle) {
        return
      }

      const text = await fileToText(await fileHandle.getFile())

      const traverseOptions: TraverseOptions = {
        JSXElement(path) {
          const loc = path.node.openingElement.name.loc
          const isTargetTag =
            loc?.start.line === source.lineNumber &&
            loc?.start.column === source.columnNumber
          if (!isTargetTag) {
            return
          }

          const attributes = path.node.openingElement.attributes

          const existingClassNameAttribute = attributes.find(
            (attribute) =>
              attribute.type === 'JSXAttribute' &&
              attribute.name.name === 'className',
          ) as t.JSXAttribute

          const className =
            existingClassNameAttribute ??
            t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(''))

          if (className.value?.type === 'StringLiteral') {
            className.value = t.stringLiteral(
              `${className.value.value} text-action`,
            )
          }

          if (!existingClassNameAttribute) {
            attributes.push(className)
          }
        },
      }

      const code = transform(text, {
        plugins: [{ visitor: traverseOptions }],
        parserOpts: {
          sourceType: 'unambiguous',
          plugins: ['typescript', 'jsx'],
        },
        generatorOpts: {
          retainLines: true,
          comments: true,
          retainFunctionParens: true,
        },
      }).code!

      await fsWriteToFile(fileHandle, code)
    }
  }, [selectedElement])

  // click
  useEffect(() => {
    const elementOnClick = (event: MouseEvent) => {
      const elementUnderCursor = event.target as HTMLElement
      if (elementUnderCursor.closest('#swip-root')) {
        return
      }

      if (!event.altKey) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      setSelectedElement(elementUnderCursor)
    }

    document.addEventListener('click', elementOnClick, { capture: true })

    return () => {
      document.removeEventListener('click', elementOnClick, { capture: true })
    }
  }, [])

  // keyboard
  useEffect(() => {
    const documentOnKeyDown = (event: KeyboardEvent) => {
      if (!selectedElement) {
        return
      }

      if (kbarContext.getState().visualState === VisualState.showing) {
        return
      }

      const selectParent = (element: HTMLElement) => {
        const parent = element.parentElement
        if (!parent) {
          return
        }
        setSelectedElement(parent)
      }

      const actionsMap = {
        ArrowLeft: () => {
          selectParent(selectedElement)
        },
        ArrowUp: () => {
          const previousElement = selectedElement.previousElementSibling

          if (!previousElement) {
            return
          }

          setSelectedElement(previousElement as HTMLElement)
        },
        ArrowDown: () => {
          const nextElement = selectedElement.nextElementSibling

          if (!nextElement) {
            return
          }

          setSelectedElement(nextElement as HTMLElement)
        },
        ArrowRight: () => {
          const firstChild = selectedElement.firstElementChild

          if (!firstChild) {
            return
          }
          setSelectedElement(firstChild as HTMLElement)
        },
        Escape: () => {
          if (selectedElement) {
            setSelectedElement(null)
            return true
          }
          return false
        },
      }

      const action = actionsMap[event.key as keyof typeof actionsMap]
      if (!action) {
        return
      }

      const shouldPrevent = action() ?? true

      if (shouldPrevent) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    document.addEventListener('keydown', documentOnKeyDown, { capture: true })

    return () => {
      document.removeEventListener('keydown', documentOnKeyDown, {
        capture: true,
      })
    }
  }, [selectedElement])

  return (
    <div>
      {/* <script src="https://cdn.tailwindcss.com"></script>
      <script>{`
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                clifford: '#da373d',
              }
            }
          }
        }
      `}</script> */}

      {selectedElement && (
        <>
          <SelectionBox selectedElement={selectedElement} />

          {selectedElement.parentElement && (
            <>
              <SelectionBoxParent
                selectedElement={selectedElement.parentElement}
              />
              {Array.from(selectedElement.parentElement.children)
                .filter((element) => {
                  return element !== selectedElement
                })
                .map((element, idx) => {
                  return (
                    <SelectionBoxSibling
                      key={idx}
                      selectedElement={element as HTMLElement}
                    />
                  )
                })}
            </>
          )}

          {Array.from(selectedElement.children).map((child, idx) => (
            <SelectionBoxChild
              key={idx}
              selectedElement={child as HTMLElement}
            />
          ))}

          <ElementNavbar
            selectedElement={selectedElement}
            onElementClick={setSelectedElement}
          />
        </>
      )}

      <KBarPortal>
        <KBarPositioner>
          <KBarAnimator>
            <KBarSearch />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
    </div>
  )
}

function RenderResults() {
  const { results } = useMatches()

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === 'string' ? (
          <div className="bg-white">{item}</div>
        ) : (
          <div
            style={{
              background: active ? '#eee' : '#fff',
            }}
          >
            {item.name}
          </div>
        )
      }
    />
  )
}

function getReactFiber(element: HTMLElement) {
  const key = Object.keys(element).find((key) => {
    return key.startsWith('__reactFiber$')
  })

  if (!key) {
    return null
  }

  const domFiber = element[key as keyof typeof element] as unknown as Fiber
  return domFiber
}

type FiberSource = {
  fileName: string
  lineNumber: number
  columnNumber: number
}

type Fiber = {
  _debugSource: FiberSource
}

function makeVscodeLink({ fileName, lineNumber, columnNumber }: FiberSource) {
  return `vscode://file${fileName}:${lineNumber}:${columnNumber}`
}

function SelectionBox(props: { selectedElement: HTMLElement }) {
  const { selectedElement } = props
  const absolutePosition = elementGetAbsolutePosition(selectedElement)

  return (
    <div
      className="pointer-events-none absolute z-[100]"
      style={{
        outline: '2px solid #0399FF',
        ...absolutePosition,
      }}
    ></div>
  )
}

function SelectionBoxParent(props: { selectedElement: HTMLElement }) {
  const { selectedElement } = props
  const absolutePosition = elementGetAbsolutePosition(selectedElement)

  return (
    <div
      className="pointer-events-none absolute bg-[#00ff0033]"
      style={{
        ...absolutePosition,
      }}
    ></div>
  )
}

function SelectionBoxSibling(props: { selectedElement: HTMLElement }) {
  const { selectedElement } = props
  const absolutePosition = elementGetAbsolutePosition(selectedElement)

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        outline: '1px solid #0399FF',
        ...absolutePosition,
      }}
    ></div>
  )
}

function SelectionBoxChild(props: { selectedElement: HTMLElement }) {
  const { selectedElement } = props
  const absolutePosition = elementGetAbsolutePosition(selectedElement)

  const adjustedPosition = {
    top: absolutePosition.top + 1,
    left: absolutePosition.left + 1,
    width: absolutePosition.width - 2,
    height: absolutePosition.height - 2,
  }

  return (
    <div
      className="pointer-events-none absolute border border-[#717171]"
      style={{
        ...adjustedPosition,
      }}
    ></div>
  )
}
