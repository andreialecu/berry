// based on: https://janosh.dev/blog/sticky-active-smooth-responsive-toc

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { throttle }                                            from 'lodash'
import { Global, css }                                         from '@emotion/core'

import styled                                                  from '@emotion/styled'
import { mediaQueries }                                        from '../responsive'
import loadable                                                from '@loadable/component'

const ScrollIntoViewIfNeeded = loadable(() => import("react-scroll-into-view-if-needed"), { ssr: false })

export const TocDiv = styled.aside`
  right: 1em;
  grid-row: span 10;
  padding: 1em;
  height: max-content;
  max-height: 80vh;
  overflow: hidden;

  ${mediaQueries.maxLaptop} {
    display: none;
  }
  ${mediaQueries.minLaptop} {
    font-size: 0.85em;
    grid-column: 2;
    position: sticky;
    top: 7em;
  }

  &::before {
    content: " ";
    border-radius: 100%;

    width: 5px;
    height: 5px;
    display: ${props => props.depth >= 1 ? `inline-block` : `none`};
    border:  ${props => props.active ? `1px solid #007aa2` : `1px solid #aaa`};;
    margin-right: 6px;
    ${props => props.active && `background-color: #007aa2`};
  }
`

export const TocTitle = styled.h2`
  font-size: 130%;
  margin: 0;
`

export const TocLink = styled.a`
  cursor: pointer;
  color: ${p => (p.active ? `#007aa2` : `#555`)};
  font-weight: ${props => props.active && `600`};
  display: block;
  margin-left: ${props => props.depth * 0.75 + `em`};
  margin-top: 0.8em;
  padding-right: 10px;

  :hover {
    color: #007aa2;
  }
  &::before {
    content: " ";
    border-radius: 100%;

    width: 5px;
    height: 5px;
    display: ${props => props.depth >= 1 ? `inline-block` : `none`};
    border:  ${props => props.active ? `1px solid #007aa2` : `1px solid #aaa`};;
    margin-right: 6px;
    ${props => props.active && `background-color: #007aa2`};
  }
`

const TocStyle = css`
html {
  scroll-behavior: smooth !important;
}

.toc {
  ${mediaQueries.minLaptop} {
    display: none;
  }
}

@keyframes highlight {
  0% {background-color: rgb(255 165 0 / 30%)}
  10% {background-color: transparent;}
  20% {background-color: rgb(255 165 0 / 30%)}
  30% {background-color: transparent;}
  40% {background-color: rgb(255 165 0 / 30%)}
  50% {background-color: transparent;}
  60% {background-color: rgb(255 165 0 / 30%)}
  to {background-color: transparent;}
}

h1, h2, h3, h4 {
  &:target, &.header-nav-initial {
    animation-name: highlight;
    animation-duration: 4s;
  }
}
`;

// the fixed header height, should be adjusted if it changes
export const HEADER_HEIGHT = 100;


// Used to calculate each heading's offset from the top of the page.
// This will be compared to window.scrollY to determine which heading
// is currently active.
const accumulateOffsetTop = (el, totalOffset = 0) => {
  while (el) {
    totalOffset += el.offsetTop - el.scrollTop + el.clientTop
    el = el.offsetParent
  }
  return totalOffset
}
export const Toc = ({ headingSelector, getTitle, getDepth, ...rest }) => {
  const { throttleTime = 100 } = rest

  const tocRef = useRef(null);

  const [headings, setHeadings] = useState({
    titles: [],
    nodes: [],
    minDepth: 0,
  })

  // Controls which heading is currently highlighted as active.
  const [active, setActive] = useState()
  const [hashUpdated, setHashUpdated] = useState(true)
  const [isMounted, setIsMounted] = useState(true)
  const [pauseScrollUpdate, setPauseScrollUpdate] = useState(0) // this is a timestamp

  useLayoutEffect(() => {
    // apply initial class to header when navigating to the page
    // in order for the animation to show
    if (window.location.hash.length > 0) {
      const el = document.getElementById(window.location.hash.slice(1));
      el && el.classList.add("header-nav-initial");
    }

    return () => { setIsMounted(false) }
  }, [])

  useLayoutEffect(() => {
    const listener = () => setHashUpdated(true);
    window.addEventListener("hashchange", listener);
    return () => { window.removeEventListener("hashchange", listener) };
  }, [])

  useEffect(() => {
    const unpause = () => isMounted && setPauseScrollUpdate(0);
    if (pauseScrollUpdate) {
      const timeoutId = setTimeout(unpause, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [pauseScrollUpdate, isMounted])


  // Read heading titles, depths and nodes from the DOM.
  useEffect(() => {
    // Fallback to sensible defaults for headingSelector, getTitle and getDepth
    // inside useEffect rather than specifying them as Toc default props to avoid
    // the need for useMemo and useCallback, resp.
    // Otherwise, these would change on every render and since this effect calls
    // setHeadings which triggers a rerender, it would cause an infinite loop.
    // The default selector targets all headings (h1, h2, ..., h6) inside
    // a main element. You can pass in whatever string or array of strings
    // targets all the headings you want to appear in the ToC.
    const selector =
      headingSelector || Array.from({ length: 6 }, (_, i) => `article h` + (i + 1))
    const nodes = Array.from(document.querySelectorAll(selector))
    const titles = nodes.map(node => ({
      title: getTitle ? getTitle(node) : (node.innerText || node.textContent),
      depth: getDepth ? getDepth(node) : Number(node.nodeName[1]),
    }))
    // Compute the minimum heading depth. Will be subtracted from each heading's
    // depth to determine the indentation of that heading in the ToC.
    const minDepth = Math.min(...titles.map(h => h.depth))
    setHeadings({ titles, nodes, minDepth })
  }, [headingSelector, getTitle, getDepth])

  // Add scroll event listener to update currently active heading.
  useLayoutEffect(() => {
    if (hashUpdated) {
      const { nodes } = headings;
      const node = nodes.findIndex(n => `#${n.id}` === window.location.hash);
      if (node >= 1) {
        setActive(node);
      }
      // delay it slightly to ensure scrolling doesn't interfere
      setTimeout(() => isMounted && setHashUpdated(false), 100)
    } else {
      // Throttling the scrollHandler saves computation and hence battery life.
      const scrollHandler = throttle(() => {
        if (hashUpdated) return;

        const { titles, nodes } = headings
        // Offsets need to be recomputed inside scrollHandler because
        // lazily-loaded content increases offsets as user scrolls down.
        const offsets = nodes.map(el => accumulateOffsetTop(el))

        const activeIndex = offsets.findIndex(
          offset => offset > window.scrollY + HEADER_HEIGHT + 1
        )

        !pauseScrollUpdate && isMounted && setActive(activeIndex === -1 ? titles.length - 1 : activeIndex - 1)
      }, throttleTime, { leading: false });

      window.addEventListener(`scroll`, scrollHandler);

      return () => { scrollHandler.cancel(); window.removeEventListener(`scroll`, scrollHandler)}
    }
  }, [headings, hashUpdated, isMounted, tocRef, pauseScrollUpdate])

  return (
    <>
      <Global styles={TocStyle} />
      <TocDiv ref={tocRef}>
        <TocTitle>Table of Contents</TocTitle>
        <nav>
          {headings.titles.map(({ title, depth }, index) => (
            <ScrollIntoViewIfNeeded key={title} active={active === index} options={{ scrollMode: "always", behavior: "smooth", boundary: tocRef.current }}>
              <TocLink
                active={active === index}
                depth={depth - headings.minDepth}
                href={`#${headings.nodes[index].id}`}
                onClick={() => {
                  setPauseScrollUpdate(Date.now());
                  setActive(index);
                }}
              >
                {title}
              </TocLink>
            </ScrollIntoViewIfNeeded>
          ))}
        </nav>
      </TocDiv>
    </>
  )
}
