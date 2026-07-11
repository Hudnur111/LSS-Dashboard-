'use strict';

const fs = require('fs');
const path = require('path');

const AAO_RULES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'shared', 'aao-rules.json'), 'utf8')
);

// 2 = "frei auf Wache" per gängiger LSS-API-Konvention - bitte gegen die
// tatsächliche fms_status-Belegung der eigenen API-Antwort verifizieren.
const AVAILABLE_FMS_STATUS = new Set([2]);

function isAvailable(vehicle) {
  return AVAILABLE_FMS_STATUS.has(vehicle.fms_status ?? vehicle.fmsStatus);
}

function countAvailableByType(vehicles) {
  const counts = new Map();
  for (const vehicle of vehicles) {
    if (!isAvailable(vehicle)) continue;
    const type = vehicle.vehicle_type_name || vehicle.type || 'Unbekannt';
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return counts;
}

// Read-only recommendation engine: it tells the player which vehicle types
// are still missing for each open mission. It never dispatches anything
// itself - actual alerting stays a manual, in-game action by the player.
function buildSuggestions(vehicles = [], missions = []) {
  const available = countAvailableByType(vehicles);
  const reserved = new Map();

  return missions
    .filter((mission) => (mission.missing_vehicles ?? mission.missingVehicles ?? 1) > 0)
    .map((mission) => {
      const caption = mission.caption || mission.name || mission.mission_type_name;
      const rule = AAO_RULES[caption] || AAO_RULES.__default__;
      const fehlend = [];

      for (const [type, needed] of Object.entries(rule.erforderlich)) {
        const alreadyReserved = reserved.get(type) || 0;
        const free = (available.get(type) || 0) - alreadyReserved;
        if (free < needed) {
          fehlend.push({ type, needed, free: Math.max(free, 0) });
        } else {
          reserved.set(type, alreadyReserved + needed);
        }
      }

      return {
        missionId: mission.id,
        caption,
        empfehlung: rule.erforderlich,
        fehlend,
        vollstaendigVerfuegbar: fehlend.length === 0,
      };
    });
}

module.exports = { buildSuggestions };
