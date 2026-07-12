'use strict';

const { Notification } = require('electron');

// Native OS notification for missions that weren't in the previous snapshot.
// Only fires while the dashboard window isn't focused - the in-app toast
// already covers the focused case, and duplicating both would just be noise.
// `previousIds.size === 0` (first snapshot after launch/demo-exit) is treated
// as "nothing to compare against yet", not "every open mission is new".
function notifyNewMissions(missions, previousIds, dashboardWindow) {
  if (!Notification.isSupported() || previousIds.size === 0) return;
  if (dashboardWindow && !dashboardWindow.isDestroyed() && dashboardWindow.isFocused()) return;

  const freshMissions = missions.filter((mission) => !previousIds.has(mission.id));
  if (freshMissions.length === 0) return;

  const title = freshMissions.length === 1 ? 'Neuer Einsatz' : `${freshMissions.length} neue Einsätze`;
  const body = freshMissions
    .slice(0, 3)
    .map((mission) => mission.caption || mission.name || 'Einsatz')
    .join(', ');

  const notification = new Notification({ title: `LSS Dashboard – ${title}`, body });
  notification.on('click', () => {
    if (!dashboardWindow || dashboardWindow.isDestroyed()) return;
    dashboardWindow.show();
    dashboardWindow.focus();
  });
  notification.show();
}

module.exports = { notifyNewMissions };
