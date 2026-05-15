import { MathJax } from 'better-react-mathjax';
import { useCallback, useLayoutEffect, useRef } from 'react';
import type { Key, ReactNode } from 'react';

/** Do not shrink rendered math below this factor; wider content then uses horizontal scroll on the slot. */
const MIN_READABLE_SCALE = 0.75;

/** Vertical padding around equation slots that show a horizontal scrollbar */
const SCROLL_SLOT_PAD_Y = '0.875rem';

/** Total vertical padding (top + bottom) in px — matches SCROLL_SLOT_PAD_Y at root font size. */
function scrollSlotVerticalPadPx(): number {
  const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return 2 * 0.875 * fs;
}

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
  /** React reconciliation key — listed so strict TS JSX accepts `<MathJax key={...}>`. */
  key?: Key | null;
  /** Outer wrapper (width, padding, overscroll, responsive overflow from Tailwind). */
  className?: string;
  /** Inner wrapper around MathJax (prose typography — never scaled). */
  contentClassName?: string;
  children: ReactNode;
  /**
   * When true, MathJax re-typesets on every React render (`better-react-mathjax` default).
   * That retriggers full layout here and can **nest duplicate `mjx-container` trees** (severe lag).
   * Keep false for stable keyed strings; set true only if `children` updates without remounting.
   */
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
  dynamic = false,
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

    const allMjxs = Array.from(inner.querySelectorAll('mjx-container')) as HTMLElement[];

    for (const mjx of allMjxs) {
      mjx.style.removeProperty('transform');
      mjx.style.removeProperty('transform-origin');
      const slot = mjx.parentElement;
      if (slot?.getAttribute(SLOT_ATTR) === 'true') {
        slot.classList.remove('mathjax-scroll-x');
        slot.style.removeProperty('min-height');
        slot.style.removeProperty('height');
        slot.style.removeProperty('overflow');
        slot.style.removeProperty('overflow-x');
        slot.style.removeProperty('overflow-y');
        slot.style.removeProperty('overscroll-behavior-x');
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
      const scaledH = naturalH * scale;
      if (needsScroll) {
        const slotH = scaledH + scrollSlotVerticalPadPx();
        slot.style.height = `${slotH}px`;
        slot.style.minHeight = `${slotH}px`;
        slot.classList.add('mathjax-scroll-x');
        slot.style.overflowX = 'auto';
        slot.style.overflowY = 'hidden';
        slot.style.overscrollBehaviorX = 'contain';
        slot.style.maxWidth = '100%';
        slot.style.paddingTop = SCROLL_SLOT_PAD_Y;
        slot.style.paddingBottom = SCROLL_SLOT_PAD_Y;
        if (isDisplayMjx(mjx)) {
          slot.style.width = '100%';
          slot.style.boxSizing = 'border-box';
        }
      } else {
        slot.classList.remove('mathjax-scroll-x');
        slot.style.height = `${scaledH}px`;
        slot.style.minHeight = `${scaledH}px`;
        slot.style.overflow = 'hidden';
        slot.style.overflowX = 'hidden';
        slot.style.removeProperty('overscroll-behavior-x');
        slot.style.removeProperty('padding-top');
        slot.style.removeProperty('padding-bottom');
        // CSS transform does not reduce layout size; `scaledH` alone can be shorter than the slot's
        // scrollable overflow — fixed height + overflow:hidden then clips rows.
        void slot.offsetHeight;
        const layoutNeedH = Math.ceil(Math.max(scaledH, slot.scrollHeight));
        slot.style.height = `${layoutNeedH}px`;
        slot.style.minHeight = `${layoutNeedH}px`;
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
