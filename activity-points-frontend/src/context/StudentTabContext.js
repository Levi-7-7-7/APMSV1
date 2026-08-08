import { createContext, useContext } from 'react';

// The four swipeable student tabs (Dashboard, Upload, Certificates, Tickets)
// used to read refreshToken/scrollToTop/refreshTicketUnreadCount via
// react-router's useOutletContext(), which only works when a component is
// rendered as the actual matched <Outlet/> child. Now that all four tabs are
// mounted directly (side by side, in a track) so dragging can peek at the
// neighboring tab like WhatsApp, they're no longer rendered through
// <Outlet/> — so they read the same values from this plain React context
// instead, provided once by StudentLayout.
const StudentTabContext = createContext({});

export const StudentTabProvider = StudentTabContext.Provider;

export default function useStudentTabContext() {
  return useContext(StudentTabContext);
}
