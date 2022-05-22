export function ElementNavbar(props: {
  selectedElement: HTMLElement
  onElementClick: (element: HTMLElement) => void
}) {
  const { selectedElement } = props
  const parentElement = selectedElement.parentElement

  if (!parentElement) {
    return null
  }

  const siblings = Array.from(parentElement.children) as HTMLElement[]
  const children = Array.from(selectedElement.children) as HTMLElement[]

  return (
    <div className="fixed w-full bottom-0 z-[99999] text-xs font-mono">
      <div
        className="mx-auto drop-shadow-lg grid justify-center w-2/3 bg-white min-w-[680px] h-[200px] rounded-t-lg border-t border-x border-slate-300"
        style={{
          gridTemplateColumns: '1fr 5fr 1fr',
        }}
      >
        <div
          className="flex flex-col bg-[#a6fea6] justify-center items-center cursor-pointer rounded-tl-lg"
          onClick={() => props.onElementClick(parentElement)}
        >
          {'<'}
          {parentElement.tagName.toLowerCase()}
          {'>'}
          {Array.from(parentElement.classList).map((cls) => {
            return <div>{cls}</div>
          })}
        </div>
        <div className="flex flex-col bg-white overflow-y-auto">
          {siblings.map((childElement) => {
            const isSelectedElement = childElement === selectedElement

            return (
              <div
                className="p-4 flex-shrink-0 cursor-pointer min-h-1/4"
                style={{
                  borderBottom: '1px solid #0399FF',
                  outline: isSelectedElement ? `2px solid #0399FF` : 'none',
                  outlineOffset: `-2px`,
                }}
                onClick={() => {
                  props.onElementClick(childElement)
                }}
              >
                <SiblingElement siblingElement={childElement} />
              </div>
            )
          })}
        </div>
        <div className="flex flex-col overflow-y-auto bg-[#eeeeee] justify-center items-center rounded-tr-lg">
          {children.map((childElement) => {
            return (
              <div
                className="cursor-pointer"
                onClick={() => props.onElementClick(childElement)}
              >
                {'<'}
                {childElement.tagName.toLowerCase()}
                {'>'}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SiblingElement(props: { siblingElement: HTMLElement }) {
  const { siblingElement } = props

  return (
    <div>
      {'<'}
      <b>{siblingElement.tagName.toLocaleLowerCase()}</b>
      {Array.from(siblingElement.attributes).map((attribute) => {
        return (
          <span>
            {' '}
            <span className="whitespace-nowrap">{attribute.name}</span>=
            <span className="text-red-700">"{attribute.value}"</span>
          </span>
        )
      })}
      {'>'}
    </div>
  )
}
