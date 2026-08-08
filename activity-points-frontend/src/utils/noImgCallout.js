// Shared prop bundle to disable the native "long-press to save/share" menu
// on mobile browsers and the right-click "Save Image As / Open Image in
// New Tab" context menu + drag-to-save on desktop, for any real (non-
// fallback-initials) profile photo <img> in the app.
//
// Usage: <img src={photo} alt="..." className="no-img-callout" {...noImgCallout} />
//
// CSS alone can't block the desktop right-click menu or dragging, so this
// pairs with the `.no-img-callout` class defined in css/theme.css.
export const noImgCallout = {
  onContextMenu: (e) => e.preventDefault(),
  draggable: false,
};
