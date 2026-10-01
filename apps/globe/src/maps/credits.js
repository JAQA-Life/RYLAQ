import * as Cesium from 'cesium';

/** Static credits follow the source actually on screen, including fallback. */
export function createMapCredits(viewer) {
  let active = null;
  let markup = null;
  return {
    show(html) {
      if (html === markup) return;
      const display = viewer?.scene?.frameState?.creditDisplay;
      if (!display) return;
      try {
        if (active) display.removeStaticCredit(active);
        // JAQA: basemap credits go in the "Data attribution" panel (opened from
        // the button on the globe), not on the globe itself. Esri's attribution
        // guidance accepts a window opened from a button.
        active = html ? new Cesium.Credit(html, false) : null;
        markup = html;
        if (active) display.addStaticCredit(active);
      } catch {
        /* Switching remains usable on older credit displays. */
      }
    },
    destroy() {
      this.show(null);
    },
  };
}
