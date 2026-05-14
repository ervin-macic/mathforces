import { MathJax } from 'better-react-mathjax';
import { useCallback, useLayoutEffect, useRef } from 'react';

/** Do not shrink rendered math below this factor; wider content then uses horizontal scroll on the slot. */
const MIN_READABLE_SCALE = 0.75;

/** Vertical padding around equation slots that show a horizontal scrollbar */
const SCROLL_SLOT_PAD_Y = '0.875rem';

const SLOT_ATTR = 'data-mathjax-fit-slot';

/** MathJax SVG nests `mjx-container` nodes; only the outermost per expression should be scaled. */
function topLevelMjxContainers(inner: HTMLElement): HTMLElement[] {
  const all = Array.from(inner.querySelectorAll<HTMLElement>('mjx-container'));
  return all.filter(mjx => {
    let el: HTMLElement | null = mjx.parentElement;
    while (el && el !== inner) {
      if (el.tagName.toLowerCase() === 'mjx-container') return false;
      el = el.parentElement;
    }
    return true;
  });
}

function isDisplayMjx(mjx: HTMLElement): boolean {
  const d = mjx.getAttribute('display');
  return d === 'block' || d === 'true';
}

/** Move `mjx` out of our slot and remove the slot (restores normal flow). */
function unwrapIfSlotted(mjx: HTMLElement): void {
  const slot = mjx.parentElement;
  if (slot?.getAttribute(SLOT_ATTR) !== 'true') return;
  slot.parentNode?.insertBefore(mjx, slot);
  slot.remove();
}

/** Wrap `mjx` in a slot used only for overflow + min-height around scaled math. */
function ensureSlot(mjx: HTMLElement): HTMLElement {
  const parent = mjx.parentElement;
  if (parent?.getAttribute(SLOT_ATTR) === 'true') {
    return parent as HTMLElement;
  }
  const slot = document.createElement('div');
  slot.setAttribute(SLOT_ATTR, 'true');
  const display = isDisplayMjx(mjx);
  slot.className = display
    ? 'mathjax-fit-slot w-full min-w-0 max-w-full block'
    : 'mathjax-fit-slot max-w-full min-w-0 align-middle inline-block';
  slot.style.maxWidth = '100%';
  if (display) {
    slot.style.width = '100%';
    slot.style.boxSizing = 'border-box';
  }
  mjx.replaceWith(slot);
  slot.appendChild(mjx);
  return slot;
}

export interface MathJaxFitBlockProps {
  /** Outer wrapper (width, padding, overscroll, responsive overflow from Tailwind). */
  className?: string;
  /** Inner wrapper around MathJax (prose typography — never scaled). */
  contentClassName?: string;
  children: React.ReactNode;
  dynamic?: boolean;
  /** When true, skip all layout work (used while rating overlay is active so the main thread stays responsive). */
  layoutPaused?: boolean;
}

/**
 * After MathJax typesets, each `mjx-container` is measured independently. If it is
 * wider than the column, that node alone is scaled (homothety) down to fit, but not
 * below {@link MIN_READABLE_SCALE}. If it would still overflow at that floor, the
 * per-equation slot gets horizontal scroll. Plain text in the same block keeps normal size.
 */
export function MathJaxFitBlock({
  className,
  contentClassName,
  children,
  dynamic = true,
  layoutPaused = false,
}: MathJaxFitBlockProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    if (layoutPaused) {
      return;
    }

    outer.style.removeProperty('min-height');
    outer.style.removeProperty('overflow-x');

    const columnW = inner.clientWidth;
    if (columnW <= 0) return;

    const allMjxs = Array.from(inner.querySelectorAll<HTMLElement>('mjx-container'));

    for (const mjx of allMjxs) {
      mjx.style.removeProperty('transform');
      mjx.style.removeProperty('transform-origin');
      const slot = mjx.parentElement;
      if (slot?.getAttribute(SLOT_ATTR) === 'true') {
        slot.style.removeProperty('min-height');
        slot.style.removeProperty('overflow-x');
        slot.style.removeProperty('overscroll-behavior-x');
        slot.style.removeProperty('scrollbar-gutter');
        slot.style.removeProperty('width');
        slot.style.removeProperty('max-width');
        slot.style.removeProperty('box-sizing');
        slot.style.removeProperty('padding-top');
        slot.style.removeProperty('padding-bottom');
      }
    }

    const mjxsTop = topLevelMjxContainers(inner);

    if (mjxsTop.length === 0) {
      return;
    }

    for (const mjx of mjxsTop) {
      const naturalW = mjx.scrollWidth;
      const naturalH = mjx.scrollHeight;
      if (naturalW <= 0 || naturalH <= 0) continue;

      const fitScale = columnW / naturalW;
      if (fitScale >= 1 - 1e-6) {
        unwrapIfSlotted(mjx);
        continue;
      }

      const scale = Math.max(fitScale, MIN_READABLE_SCALE);
      const needsScroll = naturalW * scale > columnW + 1;

      const slot = ensureSlot(mjx);
      mjx.style.transform = `scale(${scale})`;
      mjx.style.transformOrigin = 'top left';
      slot.style.minHeight = `${naturalH * scale}px`;
      if (needsScroll) {
        slot.style.overflowX = 'auto';
        slot.style.overscrollBehaviorX = 'contain';
        slot.style.setProperty('scrollbar-gutter', 'stable');
        slot.style.maxWidth = '100%';
        slot.style.paddingTop = SCROLL_SLOT_PAD_Y;
        slot.style.paddingBottom = SCROLL_SLOT_PAD_Y;
        if (isDisplayMjx(mjx)) {
          slot.style.width = '100%';
          slot.style.boxSizing = 'border-box';
        }
      } else {
        slot.style.overflowX = 'hidden';
        slot.style.removeProperty('overscroll-behavior-x');
        slot.style.removeProperty('scrollbar-gutter');
        slot.style.removeProperty('padding-top');
        slot.style.removeProperty('padding-bottom');
      }
    }
  }, [layoutPaused]);

  const scheduleMeasure = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(measure);
    });
  }, [measure]);

  const onTypeset = useCallback(() => {
    scheduleMeasure();
  }, [scheduleMeasure]);

  useLayoutEffect(() => {
    if (!layoutPaused) scheduleMeasure();
  }, [children, layoutPaused, scheduleMeasure]);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer || layoutPaused) return;

    const ro = new ResizeObserver(() => {
      scheduleMeasure();
    });
    ro.observe(outer);
    return () => ro.disconnect();
  }, [layoutPaused, scheduleMeasure]);

  return (
    <div ref={outerRef} className={className}>
      <div ref={innerRef} className={contentClassName}>
        <MathJax dynamic={dynamic} onTypeset={onTypeset}>
          {children}
        </MathJax>
      </div>
    </div>
  );
}
