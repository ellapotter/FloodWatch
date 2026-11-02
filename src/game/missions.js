export const missions = [
  {
    id: 'syn-flood',
    level: 1,
    title: 'SYN Flood',
    description: 'Learn how incomplete TCP connections can prevent users from reaching a server.',
  },
  {
    id: 'udp-flood',
    level: 2,
    title: 'UDP Flood',
    description: 'Learn how a large amount of UDP traffic can overwhelm a network.',
  },
  {
    id: 'http-flood',
    level: 3,
    title: 'HTTP Flood',
    description: 'Learn how repeated website requests can overload a web server.',
  },
  {
    id: 'dns-amplification',
    level: 4,
    title: 'DNS Amplification',
    description: 'Learn how DNS responses can be redirected to overwhelm a target.',
  },
  {
    id: 'final-mission',
    level: 5,
    title: 'Final Mission',
    description: 'Use what you learned to identify and defend against multiple attacks.',
    isFinal: true,
  },
];

export function findMission(missionId) {
  return missions.find((mission) => mission.id === missionId);
}

const levelNames = ['One', 'Two', 'Three', 'Four'];

export function getMissionDisplayTitle(mission) {
  return mission.isFinal ? 'Final Mission' : `Level ${levelNames[mission.level - 1]}`;
}
