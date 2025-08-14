// skills_info.js
// Defines per-skill descriptions of what can be done at each level.
// Each skill maps levels to an array of description strings.  These are
// displayed in the skills UI to inform players of available crafts and abilities.

export const SKILL_INFO = {
  woodworking: {
    1: [
      'Craft Logs from Rough Logs (requires an Axe)',
    ],
    2: [
      'Craft Beams from Branches',
      'Build Wood Fences from Beams',
    ],
    3: [
      'Craft Planks from Logs (requires a Saw)',
      'Craft Chests from Planks',
      'Craft Chairs and Tables from Planks and Beams',
    ],
    4: [
      'Build a Log Cabin from Logs and Beams',
    ],
  },
  stoneworking: {
    1: [
      'Craft Bricks from Stone',
    ],
    2: [
      'No additional recipes at this level',
    ],
    3: [
      'Build Stone Walls from Stone',
    ],
    4: [
      'No additional recipes at this level',
    ],
  },
  metalworking: {
    1: [
      'Smelt Ingots from Ore',
    ],
    2: [
      'Craft Pickaxes from Planks and Ore',
    ],
    3: [
      'No additional recipes at this level',
    ],
    4: [
      'No additional recipes at this level',
    ],
  },
};