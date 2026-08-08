import { createContext, useContext } from 'react';

// The four swipeable tutor tabs (Students, Add Students, Pending
// Certificates, Approved Certificates) used to read refreshToken/
// refreshPendingCount/etc. via react-router's useOutletContext(), which
// only works when a component is rendered as the actual matched
// <Outlet/> child. Now that all four tabs are mounted directly (side by
// side, in a track) so dragging can peek at the neighboring tab like
// WhatsApp — same treatment as StudentTabContext — they're no longer
// rendered through <Outlet/>, so they read the same values from this
// plain React context instead, provided once by TutorDashboard.
const TutorTabContext = createContext({});

export const TutorTabProvider = TutorTabContext.Provider;

export default function useTutorTabContext() {
  return useContext(TutorTabContext);
}
