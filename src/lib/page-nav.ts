// Leaving the app for another page (a sign-out at WorkOS, the signed-out
// page). One object, so the screen tests can watch where it goes: jsdom
// can't follow a real page change.
export const pageNav = {
  go(url: string) {
    window.location.assign(url);
  },
};
