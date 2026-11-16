import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Environment } from "@react-three/drei";
import * as THREE from "three";
import "./SpaceExplorer.css";

const SITES = [
 {
  "id": "apollo11",
  "name": "Apollo 11 – Tranquility Base",
  "year": 1969,
  "lat": 0.674,
  "lon": 23.473,
  "model": "lm",
  "object": "Eagle descent stage",
  "story": [
   "On July 20, 1969, Neil Armstrong and Buzz Aldrin landed the lunar module Eagle in the Sea of Tranquility.",
   "When it was time to leave, only the top half, the ascent stage, lifted off. The gold-foil descent stage stayed behind and became the launch pad.",
   "It still stands there today, along with a flag, a plaque reading 'We came in peace for all mankind', and bags of discarded gear."
  ],
  "left": [
   "Eagle descent stage",
   "US flag",
   "Plaque: 'We came in peace for all mankind'",
   "Seismometer and laser reflector",
   "Medals honoring cosmonauts Gagarin and Komarov",
   "Silicon disc of goodwill messages",
   "Bags of discarded gear and boots"
  ],
  "pin": "11",
  "kind": "apollo",
  "body": "moon"
 },
 {
  "id": "apollo12",
  "name": "Apollo 12 – Surveyor 3",
  "year": 1969,
  "lat": -3.01,
  "lon": -23.42,
  "model": "surveyor",
  "object": "Surveyor 3 probe",
  "story": [
   "Apollo 12 landed just 160 m from Surveyor 3, a robotic probe sent to the Moon in 1967.",
   "Pete Conrad and Alan Bean walked over and cut off its camera and parts of its tubing, bringing them home to study how materials aged in space.",
   "The rest of Surveyor 3 is still sitting in its crater."
  ],
  "left": [
   "Surveyor 3 probe (camera and parts taken home)",
   "Apollo 12 descent stage",
   "ALSEP science station",
   "US flag"
  ],
  "pin": "12",
  "kind": "apollo",
  "body": "moon"
 },
 {
  "id": "apollo14",
  "name": "Apollo 14 – Fra Mauro",
  "year": 1971,
  "lat": -3.65,
  "lon": -17.47,
  "model": "cart",
  "object": "Modular Equipment Transporter (MET)",
  "story": [
   "Alan Shepard and Edgar Mitchell used a two-wheeled cart, the MET, to haul tools and rock samples across Fra Mauro.",
   "Shepard also hit two golf balls with a makeshift club. They are still out there.",
   "The cart was left on the surface when the crew departed."
  ],
  "left": [
   "Modular Equipment Transporter cart",
   "ALSEP science station",
   "Two golf balls",
   "Apollo 14 descent stage",
   "US flag"
  ],
  "pin": "14",
  "kind": "apollo",
  "body": "moon"
 },
 {
  "id": "apollo15",
  "name": "Apollo 15 – Hadley Rille",
  "year": 1971,
  "lat": 26.13,
  "lon": 3.63,
  "model": "rover",
  "object": "Lunar Roving Vehicle",
  "story": [
   "Apollo 15 was the first mission to drive on the Moon. David Scott and James Irwin covered about 28 km in the Lunar Roving Vehicle.",
   "The electric rover could carry two astronauts and a load of samples.",
   "At the end of the last drive, Scott parked it facing the TV camera so Earth could watch liftoff. It was never driven again."
  ],
  "left": [
   "Lunar Roving Vehicle",
   "'Fallen Astronaut' figurine and plaque",
   "ALSEP science station",
   "Apollo 15 descent stage",
   "US flag"
  ],
  "pin": "15",
  "kind": "apollo",
  "body": "moon"
 },
 {
  "id": "apollo16",
  "name": "Apollo 16 – Descartes Highlands",
  "year": 1972,
  "lat": -8.97,
  "lon": 15.5,
  "model": "alsep",
  "object": "Science station (ALSEP)",
  "story": [
   "In April 1972 John Young and Charles Duke landed in the Descartes Highlands, the first mission to explore the Moon's rugged mountains.",
   "They set up a science station, the ALSEP, to measure moonquakes, heat flow and magnetic fields, and drove the rover for about 27 km.",
   "Duke left a photo of his family on the surface. The station kept sending data to Earth until 1977."
  ],
  "left": [
   "ALSEP science station",
   "Lunar Roving Vehicle",
   "Far-ultraviolet camera",
   "Duke's family photo",
   "Apollo 16 descent stage",
   "US flag"
  ],
  "pin": "16",
  "kind": "apollo",
  "body": "moon"
 },
 {
  "id": "apollo17",
  "name": "Apollo 17 – Taurus-Littrow",
  "year": 1972,
  "lat": 20.19,
  "lon": 30.77,
  "model": "flag",
  "object": "Flag and rover",
  "story": [
   "Apollo 17 was the last crewed mission to the Moon. Gene Cernan and Harrison Schmitt spent three days in Taurus-Littrow valley.",
   "They left a plaque on the descent stage that says humans would return in peace.",
   "Their rover, flag and equipment remain where they were parked in December 1972."
  ],
  "left": [
   "Lunar Roving Vehicle",
   "Descent stage with commemorative plaque",
   "ALSEP science station",
   "US flag"
  ],
  "pin": "17",
  "kind": "apollo",
  "body": "moon"
 },
 {
  "id": "chandrayaan3",
  "pin": "CH3",
  "kind": "other",
  "country": "India",
  "name": "Chandrayaan-3 – Shiv Shakti Point",
  "year": 2023,
  "lat": -69.373,
  "lon": 32.319,
  "model": "lander",
  "object": "Vikram lander and Pragyan rover",
  "story": [
   "On 23 August 2023, India's Vikram lander touched down about 600 km from the Moon's south pole. India became the fourth country to soft-land on the Moon and the first to land near the south polar region.",
   "The Pragyan rover rolled out and drove about 100 m, testing the soil with onboard instruments. Its results confirmed sulfur in the polar soil.",
   "On 3 September the lander made a small hop of 30–40 cm, then both machines were put to sleep. The site was named Statio Shiv Shakti by the IAU in 2024."
  ],
  "left": [
   "Vikram lander",
   "Pragyan rover",
   "Tracks left by the rover"
  ],
  "body": "moon"
 },
 {
  "id": "lunokhod1",
  "pin": "L1",
  "kind": "other",
  "country": "Soviet Union",
  "name": "Luna 17 – Lunokhod 1",
  "year": 1970,
  "lat": 38.316,
  "lon": -35.005,
  "model": "lunokhod",
  "object": "Lunokhod 1 rover",
  "story": [
   "On 17 November 1970 the Soviet Luna 17 landed in northwest Mare Imbrium and released Lunokhod 1, the first robotic rover to drive on another world.",
   "Controlled from Earth, it worked for 322 days and covered about 10.5 km.",
   "It is still parked there, together with the Luna 17 landing stage."
  ],
  "left": [
   "Lunokhod 1 rover",
   "Luna 17 landing stage",
   "Laser reflector"
  ],
  "body": "moon"
 },
 {
  "id": "lunokhod2",
  "pin": "L2",
  "kind": "other",
  "country": "Soviet Union",
  "name": "Luna 21 – Lunokhod 2",
  "year": 1973,
  "lat": 25.832,
  "lon": 30.92,
  "model": "lunokhod",
  "object": "Lunokhod 2 rover",
  "story": [
   "Luna 21 landed on 15 January 1973 inside Le Monnier crater, on the edge of Mare Serenitatis. This is about 180 km from where Apollo 17 had landed a month earlier.",
   "Lunokhod 2 worked for almost four months and drove roughly 37–39 km, the farthest any rover had gone on the Moon at the time.",
   "NASA's Lunar Reconnaissance Orbiter later photographed the rover still parked on the crater floor."
  ],
  "left": [
   "Lunokhod 2 rover",
   "Luna 21 landing stage"
  ],
  "body": "moon"
 },
 {
  "id": "change3",
  "pin": "CE3",
  "kind": "other",
  "country": "China",
  "name": "Chang'e 3 – Mare Imbrium",
  "year": 2013,
  "lat": 44.122,
  "lon": -19.511,
  "model": "lander",
  "object": "Chang'e 3 lander and Yutu rover",
  "story": [
   "On 14 December 2013, Chang'e 3 made the first soft landing on the Moon since 1976, in northern Mare Imbrium.",
   "Its Yutu (Jade Rabbit) rover was immobilized in January 2014, but the lander kept working for years.",
   "NASA's Lunar Reconnaissance Orbiter has imaged both machines from orbit."
  ],
  "left": [
   "Chang'e 3 lander",
   "Yutu rover"
  ],
  "body": "moon"
 },
 {
  "id": "change4",
  "pin": "CE4",
  "kind": "other",
  "country": "China",
  "name": "Chang'e 4 – Far side",
  "year": 2019,
  "lat": -45.457,
  "lon": 177.589,
  "model": "lander",
  "object": "Chang'e 4 lander and Yutu-2 rover",
  "story": [
   "On 3 January 2019, Chang'e 4 made humanity's first soft landing on the far side of the Moon, inside Von Kármán crater in the South Pole-Aitken Basin.",
   "Because the far side never faces Earth, the Queqiao relay satellite, parked beyond the Moon, passes the signals back and forth.",
   "The Yutu-2 rover has been exploring the crater floor ever since."
  ],
  "left": [
   "Chang'e 4 lander",
   "Yutu-2 rover"
  ],
  "body": "moon"
 },
 {
  "id": "change5",
  "pin": "CE5",
  "kind": "other",
  "country": "China",
  "name": "Chang'e 5 – Mons Rümker",
  "year": 2020,
  "lat": 43.058,
  "lon": -51.916,
  "model": "lander",
  "object": "Chang'e 5 descent stage",
  "story": [
   "Chang'e 5 landed on 1 December 2020 near Mons Rümker in Oceanus Procellarum.",
   "It drilled and scooped 1,731 g of lunar soil, the first samples brought back to Earth since 1976. The ascender lifted off on 3 December and the samples returned to Earth in mid-December.",
   "The descent stage stayed behind on the surface."
  ],
  "left": [
   "Chang'e 5 descent stage"
  ],
  "body": "moon"
 },
 {
  "id": "change6",
  "pin": "CE6",
  "kind": "other",
  "country": "China",
  "name": "Chang'e 6 – Apollo basin",
  "year": 2024,
  "lat": -41.639,
  "lon": -153.985,
  "model": "lander",
  "object": "Chang'e 6 descent stage",
  "story": [
   "On 1 June 2024, Chang'e 6 landed in the Apollo basin on the far side of the Moon.",
   "It collected samples there and made the first return of material from the lunar far side later that month.",
   "NASA's Lunar Reconnaissance Orbiter photographed the lander a few days after it touched down."
  ],
  "left": [
   "Chang'e 6 descent stage",
   "Chinese flag"
  ],
  "body": "moon"
 },
 {
  "id": "viking1",
  "pin": "V1",
  "kind": "us",
  "body": "mars",
  "country": "USA",
  "name": "Viking 1 – Chryse Planitia",
  "year": 1976,
  "lat": 22.48,
  "lon": -47.968,
  "model": "lander",
  "object": "Viking 1 lander",
  "story": [
   "Viking 1 landed on 20 July 1976 and became the first US spacecraft to work on the surface of Mars.",
   "It took pictures and ran experiments that searched the soil for signs of life.",
   "It is a stationary lander, so it never moved. It stopped working in 1982 and is still there."
  ],
  "left": [
   "Viking 1 lander",
   "Heat shield and parachute remains",
   "Ejected landing hardware"
  ]
 },
 {
  "id": "viking2",
  "pin": "V2",
  "kind": "us",
  "body": "mars",
  "country": "USA",
  "name": "Viking 2 – Utopia Planitia",
  "year": 1976,
  "lat": 47.97,
  "lon": 134.26,
  "model": "lander",
  "object": "Viking 2 lander",
  "story": [
   "Viking 2 landed on 3 September 1976, farther north than its twin.",
   "It studied Martian soil and the atmosphere, and photographed frost on the ground.",
   "It worked until 1980. A metal shroud it ejected during landing can still be seen in 1977 images."
  ],
  "left": [
   "Viking 2 lander",
   "Ejected metal shroud",
   "Heat shield and parachute remains"
  ]
 },
 {
  "id": "pathfinder",
  "pin": "PF",
  "kind": "us",
  "body": "mars",
  "country": "USA",
  "name": "Mars Pathfinder – Ares Vallis",
  "year": 1997,
  "lat": 19.33,
  "lon": -33.55,
  "model": "marsrover",
  "object": "Pathfinder lander and Sojourner rover",
  "story": [
   "Mars Pathfinder landed on 4 July 1997 by bouncing to a stop inside giant airbags.",
   "It delivered Sojourner, the first successful wheeled rover on Mars, which explored nearby rocks and soil.",
   "The lander was later renamed the Carl Sagan Memorial Station."
  ],
  "left": [
   "Pathfinder lander",
   "Sojourner rover",
   "Deflated landing airbags",
   "Parachute and backshell"
  ]
 },
 {
  "id": "spirit",
  "pin": "SP",
  "kind": "us",
  "body": "mars",
  "country": "USA",
  "name": "Spirit – Gusev Crater",
  "year": 2004,
  "lat": -14.5719,
  "lon": 175.4785,
  "model": "marsrover",
  "object": "Spirit rover",
  "story": [
   "Spirit landed in January 2004 in Gusev Crater.",
   "It found evidence that water once altered the rocks of Mars.",
   "In 2009 it got stuck in soft sand. It sent its last signal in 2010 and is still parked there."
  ],
  "left": [
   "Spirit rover",
   "Landing platform",
   "Heat shield, parachute and backshell",
   "Rover wheel tracks"
  ]
 },
 {
  "id": "opportunity",
  "pin": "OP",
  "kind": "us",
  "body": "mars",
  "country": "USA",
  "name": "Opportunity – Meridiani Planum",
  "year": 2004,
  "lat": -1.9462,
  "lon": -5.5266,
  "model": "marsrover",
  "object": "Opportunity rover",
  "story": [
   "Opportunity landed in January 2004 on Meridiani Planum.",
   "It found strong evidence that liquid water once existed on ancient Mars, including small round mineral 'blueberries'.",
   "A huge dust storm silenced it in 2018. It had lasted about 15 years instead of the planned 90 days."
  ],
  "left": [
   "Opportunity rover",
   "Landing platform in Eagle crater",
   "Discarded heat shield",
   "Rover wheel tracks"
  ]
 },
 {
  "id": "phoenix",
  "pin": "PH",
  "kind": "us",
  "body": "mars",
  "country": "USA",
  "name": "Phoenix – Arctic plains",
  "year": 2008,
  "lat": 68.2188,
  "lon": -125.7492,
  "model": "lander",
  "object": "Phoenix lander",
  "story": [
   "Phoenix landed in 2008 near the north pole of Mars.",
   "It dug into the soil and found water ice just beneath the surface. It also found perchlorate salts.",
   "When winter darkness came the solar panels lost power, and the lander went silent in November 2008."
  ],
  "left": [
   "Phoenix lander",
   "Heat shield",
   "Parachute and backshell"
  ]
 },
 {
  "id": "curiosity",
  "pin": "CU",
  "kind": "us",
  "body": "mars",
  "country": "USA",
  "name": "Curiosity – Gale Crater",
  "year": 2012,
  "lat": -4.5895,
  "lon": 137.4417,
  "model": "marsrover",
  "object": "Curiosity rover",
  "story": [
   "Curiosity landed in August 2012 using a rocket-powered 'sky crane'.",
   "It studies ancient environments, rocks and chemistry, and whether Mars once supported microbial life. It found organic molecules and methane.",
   "It is still driving up Mount Sharp, leaving its wheel tracks and landing debris behind."
  ],
  "left": [
   "Curiosity rover (active)",
   "Sky crane and landing wreckage",
   "Heat shield",
   "Rover wheel tracks",
   "Parachute and backshell"
  ]
 },
 {
  "id": "insight",
  "pin": "IN",
  "kind": "us",
  "body": "mars",
  "country": "USA",
  "name": "InSight – Elysium Planitia",
  "year": 2018,
  "lat": 4.502,
  "lon": 135.623,
  "model": "lander",
  "object": "InSight lander",
  "story": [
   "InSight landed in 2018 on a flat plain called Elysium Planitia.",
   "It measured marsquakes and investigated the planet's interior.",
   "Dust covered its solar panels. The mission ended in December 2022, and the lander stays where it landed."
  ],
  "left": [
   "InSight lander",
   "Seismometer and heat probe",
   "Heat shield and backshell"
  ]
 },
 {
  "id": "perseverance",
  "pin": "PE",
  "kind": "us",
  "body": "mars",
  "country": "USA",
  "name": "Perseverance and Ingenuity – Jezero Crater",
  "year": 2021,
  "lat": 18.4446,
  "lon": 77.4509,
  "model": "marsrover",
  "object": "Perseverance rover and Ingenuity helicopter",
  "story": [
   "Perseverance landed in Jezero Crater on 18 February 2021. The crater held a lake long ago.",
   "It searches for signs of ancient microbial life and collects rock samples in tubes. Some tubes were left on the ground in a sample depot.",
   "It carried Ingenuity, the first powered aircraft to fly on another planet. Ingenuity's flight mission ended in 2024, and the helicopter stays where it landed."
  ],
  "left": [
   "Perseverance rover (active)",
   "Ingenuity helicopter",
   "Sample tubes in the depot",
   "Landing wreckage: parachute, backshell, heat shield"
  ]
 },
 {
  "id": "zhurong",
  "pin": "ZH",
  "kind": "other",
  "body": "mars",
  "country": "China",
  "name": "Zhurong – Utopia Planitia",
  "year": 2021,
  "lat": 25.066,
  "lon": 109.925,
  "model": "marsrover",
  "object": "Zhurong rover",
  "story": [
   "China's Tianwen-1 mission put a lander and the Zhurong rover on Utopia Planitia in May 2021.",
   "Zhurong studied soil, rocks and evidence of ancient water, and drove more than 1.9 km.",
   "Tianwen-1's orbiter is still studying Mars from above."
  ],
  "left": [
   "Zhurong rover",
   "Tianwen-1 lander",
   "Rover wheel tracks"
  ]
 },
 {
  "id": "mars3",
  "pin": "M3",
  "kind": "failed",
  "body": "mars",
  "country": "Soviet Union",
  "name": "Mars 3 – Soviet lander",
  "year": 1971,
  "lat": -45.0,
  "lon": -158.0,
  "model": "lander",
  "object": "Mars 3 lander",
  "story": [
   "Mars 3 landed on 2 December 1971 and was the first spacecraft to soft-land on Mars.",
   "It sent signals for only about 20 seconds before communication stopped. Possibly a dust storm was to blame.",
   "It also carried a small PrOP-M rover that never got to drive."
  ],
  "left": [
   "Mars 3 lander",
   "PrOP-M mini-rover",
   "Soviet pennants"
  ]
 },
 {
  "id": "mars2",
  "pin": "M2",
  "kind": "failed",
  "body": "mars",
  "country": "Soviet Union",
  "name": "Mars 2 – Soviet lander",
  "year": 1971,
  "lat": -44.2,
  "lon": 47.0,
  "model": "lander",
  "object": "Mars 2 lander",
  "story": [
   "Mars 2 was a Soviet lander launched in 1971.",
   "It crashed during landing, but became the first human-made object to reach the Martian surface.",
   "Its twin, Mars 3, landed a few days later."
  ],
  "left": [
   "Wreckage of the Mars 2 lander",
   "Soviet pennants"
  ]
 },
 {
  "id": "beagle2",
  "pin": "BG",
  "kind": "failed",
  "body": "mars",
  "country": "Europe",
  "name": "Beagle 2 – Isidis Planitia",
  "year": 2003,
  "lat": 11.5,
  "lon": 90.4,
  "model": "lander",
  "object": "Beagle 2 lander",
  "story": [
   "Beagle 2 was a small British lander carried to Mars by Europe's Mars Express in 2003.",
   "It reached the surface, but its solar panels did not fully open and it could not call home.",
   "Eleven years later, NASA's orbiter photographed it and showed that it had landed safely."
  ],
  "left": [
   "Beagle 2 lander (partly opened)"
  ]
 },
 {
  "id": "schiaparelli",
  "pin": "SC",
  "kind": "failed",
  "body": "mars",
  "country": "Europe",
  "name": "Schiaparelli – Meridiani Planum",
  "year": 2016,
  "lat": -2.05,
  "lon": -6.21,
  "model": "lander",
  "object": "Schiaparelli lander",
  "story": [
   "Schiaparelli was a European test lander that arrived at Mars in October 2016.",
   "It crashed during landing, but the data it sent helped engineers improve future landing technology.",
   "NASA's Mars Reconnaissance Orbiter photographed the impact site."
  ],
  "left": [
   "Crash site and fragments",
   "Parachute and backshell"
  ]
 }
];

const R = 2;
// If the Mars map looks shifted sideways, change this number (degrees)
const LON_OFFSET = { moon: 0, mars: 0 };
// Texture files are looked up in frontend/public (first name that exists is used)
const TEXTURES = { moon: [["/moon.jpg", "/m.jpg"], "#b9b6b0"], mars: [["/mars.jpg"], "#b5532f"] };
const API = import.meta.env.VITE_API_URL || "";
const COLORS = { apollo: "#ff3b30", us: "#ff3b30", other: "#38bdf8", failed: "#ffa62b" };
const toVec = (lat, lon, r = R) => {
  const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)).multiplyScalar(r);
};

/* ---------- Planet with clickable sites ---------- */
function MoonTexture({ src }) {
  const map = useLoader(THREE.TextureLoader, src);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return <meshBasicMaterial map={map} />;
}

// Uses the first image that really exists. (Vite answers 200 + HTML for missing files, so check the type.)
function PlanetMaterial({ srcs, fallback }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const u of srcs) {
        try {
          const r = await fetch(u, { method: "HEAD" });
          if (r.ok && (r.headers.get("content-type") || "").startsWith("image")) { alive && setSrc(u); return; }
        } catch { /* try next */ }
      }
    })();
    return () => { alive = false; };
  }, [srcs]);
  return src ? <MoonTexture src={src} /> : <meshBasicMaterial color={fallback} />;
}

// Keeps the whole planet on screen on phones, tablets and desktops
function Responsive() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.setLength(Math.max(6.5, 5.3 / (size.width / size.height)));
  }, [camera, size.width, size.height]);
  return null;
}

function Moon({ sites, selected, onSelect, srcs, fallback }) {
  const group = useRef();
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Quaternion(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3), g = group.current;
    if (selected) {
      const v = toVec(selected.lat, selected.lon + (LON_OFFSET[selected.body] || 0), 1).normalize();
      target.setFromUnitVectors(v, new THREE.Vector3(0, 0, 1));
      g.quaternion.slerp(target, k);
    }
    // Make room for the info panel: side panel on wide screens, bottom sheet on small ones
    const narrow = size.width < 900;
    const visH = 2 * camera.position.length() * Math.tan(THREE.MathUtils.degToRad(22.5));
    const visW = (visH * size.width) / size.height;
    if (!selected) goal.set(0, 0, 0);
    else if (narrow) goal.set(0, visH * 0.24, 0);
    else goal.set(-((Math.min(440, size.width * 0.5) / size.width) * visW) / 2, 0, 0);
    g.position.lerp(goal, k);
    const s = selected && narrow ? 0.62 : 1;
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * k);
  });
  return (
    <group ref={group} rotation={[0, -Math.PI / 2, 0]}>
      <mesh>
        <sphereGeometry args={[R, 96, 96]} />
        <PlanetMaterial srcs={srcs} fallback={fallback} />
      </mesh>
      {sites.map((s) => (
        <Marker key={s.id} site={s} active={selected?.id === s.id} onSelect={onSelect} />
      ))}
    </group>
  );
}

function Marker({ site, active, onSelect }) {
  const root = useRef(), pulse = useRef(), label = useRef(), facing = useRef(true);
  const [hover, setHover] = useState(false);
  const world = useMemo(() => new THREE.Vector3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(() => toVec(site.lat, site.lon + (LON_OFFSET[site.body] || 0), R * 1.004), [site]);
  const normal = useMemo(() => pos.clone().normalize(), [pos]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal), [normal]);
  const off = useMemo(() => normal.clone().multiplyScalar(0.17), [normal]);
  const upQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal), [normal]);
  const Relic = MODELS[site.model] || MODELS.lm;
  const color = active ? "#ffd166" : COLORS[site.kind] || "#ff3b30";

  useFrame(({ clock, camera }) => {
    const planet = root.current.parent;
    root.current.getWorldPosition(world);
    planet.getWorldPosition(center);
    const toCam = camera.position.clone().sub(center);
    const horizon = (R * planet.scale.x) / toCam.length();
    facing.current = world.sub(center).normalize().dot(toCam.normalize()) > horizon + 0.03;
    root.current.visible = facing.current;
    if (label.current) label.current.style.display = facing.current ? "block" : "none";
    const t = (clock.elapsedTime * 0.8) % 1;
    pulse.current.scale.setScalar(1 + t * 1.6);
    pulse.current.material.opacity = (1 - t) * 0.9;
  });

  const open = (e) => { e.stopPropagation(); if (facing.current) onSelect(site); };

  return (
    <group ref={root} position={pos}>
      {/* circle drawn flat on the moon surface */}
      <group quaternion={quat} renderOrder={10}>
        <mesh>
          <circleGeometry args={[0.035, 24]} />
          <meshBasicMaterial color={color} depthTest={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.065, 0.085, 32]} />
          <meshBasicMaterial color={color} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={pulse}>
          <ringGeometry args={[0.065, 0.08, 32]} />
          <meshBasicMaterial color={color} depthTest={false} transparent side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* the actual relic, standing on the moon at this site */}
      <group position={normal.clone().multiplyScalar(0.07)} quaternion={upQuat} scale={0.055}>
        <Relic />
      </group>
      {/* big invisible hit area so the spot is easy to click */}
      <mesh onClick={open}
        onPointerOver={(e) => (e.stopPropagation(), setHover(true), (document.body.style.cursor = "pointer"))}
        onPointerOut={() => (setHover(false), (document.body.style.cursor = "auto"))}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Html center position={off} zIndexRange={[10, 0]}>
        <button ref={label} className={"pin" + (active || hover ? " on" : "")} onClick={() => onSelect(site)}>
          {hover || active ? `${site.name.split(" – ")[0]}: ${site.object}` : site.pin}
        </button>
      </Html>
    </group>
  );
}

function Headlight() {
  const l = useRef();
  useFrame(({ camera }) => l.current.position.copy(camera.position));
  return <directionalLight ref={l} intensity={2.4} />;
}

/* ---------- Procedural 3D relics (swap for GLB via useGLTF if you have models) ---------- */
const gold = <meshStandardMaterial color="#d9a441" metalness={0.8} roughness={0.35} />;
const steel = <meshStandardMaterial color="#b9bcc2" metalness={0.7} roughness={0.4} />;
const dark = <meshStandardMaterial color="#26282c" roughness={0.8} />;

function Wheel({ p }) {
  return (
    <mesh position={p} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.35, 0.35, 0.2, 24]} />{dark}
    </mesh>
  );
}

const MODELS = {
  lm: () => (
    <group>
      <mesh><cylinderGeometry args={[1, 1, 0.9, 8]} />{gold}</mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[1.3, -0.7, 0]} rotation={[0, 0, 0.6]}><cylinderGeometry args={[0.04, 0.04, 1.6]} />{steel}</mesh>
            <mesh position={[1.75, -1.4, 0]}><cylinderGeometry args={[0.28, 0.28, 0.05, 16]} />{steel}</mesh>
          </group>
        );
      })}
    </group>
  ),
  rover: () => (
    <group>
      <mesh><boxGeometry args={[1.6, 0.15, 2.4]} />{steel}</mesh>
      <mesh position={[0, 0.7, -0.7]}><boxGeometry args={[0.7, 0.1, 0.5]} />{gold}</mesh>
      <mesh position={[0, 0.9, -0.9]} rotation={[0.5, 0, 0]}><cylinderGeometry args={[0.45, 0.45, 0.04, 24]} />{steel}</mesh>
      {[[-0.95, -0.2, 0.9], [0.95, -0.2, 0.9], [-0.95, -0.2, -0.9], [0.95, -0.2, -0.9]].map((p, i) => <Wheel key={i} p={p} />)}
    </group>
  ),
  surveyor: () => (
    <group>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.15, 0.15, 2.4]} />{steel}</mesh>
      <mesh position={[0, 0.8, 0]} rotation={[0, 0, 0]}><boxGeometry args={[1.4, 0.05, 0.7]} />
        <meshStandardMaterial color="#2a4d8f" metalness={0.5} roughness={0.4} /></mesh>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
          <mesh position={[0.9, -0.7, 0]} rotation={[0, 0, 0.7]}><cylinderGeometry args={[0.04, 0.04, 1.8]} />{steel}</mesh>
        </group>
      ))}
    </group>
  ),
  cart: () => (
    <group>
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[1, 0.6, 1.4]} />{steel}</mesh>
      <mesh position={[0, 0.9, 0.8]} rotation={[-0.4, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 1.2]} />{dark}</mesh>
      <Wheel p={[-0.65, -0.1, 0]} /><Wheel p={[0.65, -0.1, 0]} />
    </group>
  ),
  lander: () => (
    <group>
      <mesh><boxGeometry args={[1.5, 0.8, 1.5]} />{steel}</mesh>
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[1.3, 0.12, 1.3]} />
        <meshStandardMaterial color="#2a4d8f" metalness={0.5} roughness={0.4} /></mesh>
      {[[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, b], i) => (
        <group key={i}>
          <mesh position={[a * 1.05, -0.75, b * 1.05]} rotation={[b * 0.5, 0, -a * 0.5]}><cylinderGeometry args={[0.04, 0.04, 1.5]} />{steel}</mesh>
          <mesh position={[a * 1.35, -1.4, b * 1.35]}><cylinderGeometry args={[0.25, 0.25, 0.05, 16]} />{steel}</mesh>
        </group>
      ))}
    </group>
  ),
  lunokhod: () => (
    <group>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.9, 0.7, 0.8, 24]} />{steel}</mesh>
      <mesh position={[0, 0.9, -0.5]} rotation={[-0.9, 0, 0]}><cylinderGeometry args={[0.9, 0.9, 0.05, 24]} />{gold}</mesh>
      {[-1.1, 1.1].flatMap((x) => [-0.9, -0.3, 0.3, 0.9].map((z) => <Wheel key={x + "" + z} p={[x, -0.4, z]} />))}
    </group>
  ),
  marsrover: () => (
    <group>
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[1.4, 0.5, 2]} />{steel}</mesh>
      <mesh position={[0.4, 1.1, 0.6]}><cylinderGeometry args={[0.05, 0.05, 1.4]} />{dark}</mesh>
      <mesh position={[0.4, 1.8, 0.6]}><boxGeometry args={[0.4, 0.25, 0.25]} />{gold}</mesh>
      <mesh position={[0, 0.6, -0.5]} rotation={[0.3, 0, 0]}><boxGeometry args={[1.2, 0.06, 0.8]} />
        <meshStandardMaterial color="#2a4d8f" metalness={0.5} roughness={0.4} /></mesh>
      {[-0.95, 0.95].flatMap((x) => [-0.8, 0, 0.8].map((z) => <Wheel key={x + "" + z} p={[x, -0.3, z]} />))}
    </group>
  ),
  alsep: () => (
    <group>
      <mesh position={[0, -0.9, 0]}><boxGeometry args={[1.4, 0.5, 1]} />{gold}</mesh>
      <mesh position={[0.9, 0.3, 0]} rotation={[0, 0, 0.5]}><cylinderGeometry args={[0.03, 0.03, 2.2]} />{steel}</mesh>
      <mesh position={[1.35, 1.3, 0]} rotation={[0, 0, 0.5]}><sphereGeometry args={[0.5, 24, 12, 0, Math.PI * 2, 0, 1.2]} />{steel}</mesh>
      <mesh position={[-0.9, -1.2, 0.6]}><cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />{dark}</mesh>
    </group>
  ),
  flag: () => (
    <group>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.03, 0.03, 2.4]} />{steel}</mesh>
      <mesh position={[0.7, 1.4, 0]}><boxGeometry args={[1.4, 0.9, 0.02]} />
        <meshStandardMaterial color="#e8e8ee" /></mesh>
      <mesh position={[0.35, 1.55, 0.02]}><boxGeometry args={[0.6, 0.45, 0.01]} />
        <meshStandardMaterial color="#2c3f8f" /></mesh>
      <mesh position={[1, 1.2, 0.02]}><boxGeometry args={[0.7, 0.12, 0.01]} />
        <meshStandardMaterial color="#c0392b" /></mesh>
    </group>
  ),
};

function RelicViewer({ model }) {
  const Model = MODELS[model] || MODELS.lm;
  return (
    <Canvas camera={{ position: [3.5, 2, 4.5], fov: 40 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 6, 3]} intensity={2.2} />
      <Environment preset="sunset" />
      <Model />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
        <circleGeometry args={[4, 48]} />
        <meshStandardMaterial color="#6f6c68" roughness={1} />
      </mesh>
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1.2} minDistance={3} maxDistance={9} />
    </Canvas>
  );
}

/* ---------- Story panel ---------- */
function Panel({ site, onClose }) {
  const [media, setMedia] = useState([]);
  const [err, setErr] = useState("");
  const [step, setStep] = useState(0);

  useEffect(() => {
    setMedia([]); setErr(""); setStep(0);
    fetch(`${API}/api/sites/${site.id}/media`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMedia)
      .catch(() => setErr("Couldn't load NASA photos. Check that the backend is running."));
  }, [site.id]);

  const last = step === site.story.length - 1;
  return (
    <aside className="panel">
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      <p className="meta">{site.year}, {site.name}</p>
      <h2>{site.object}</h2>
      <div className="viewer"><RelicViewer model={site.model} /></div>
      <p className="hint">Drag to turn it, scroll to zoom.</p>

      <h3>What they left behind</h3>
      <ul className="left">{(site.left || []).map((t) => <li key={t}>{t}</li>)}</ul>

      <div className="story">
        {site.story.slice(0, step + 1).map((t, i) => <p key={i}>{t}</p>)}
        {!last && <button onClick={() => setStep(step + 1)}>Continue the story</button>}
      </div>

      <h3>From the NASA archive</h3>
      {err && <p className="err">{err}</p>}
      {!err && !media.length && <p className="hint">Loading photos…</p>}
      <div className="gallery">
        {media.map((m) => (
          <figure key={m.nasa_id}>
            <img src={m.image} alt={m.title} loading="lazy" />
            <figcaption>{m.title}{m.date && ` (${m.date})`}</figcaption>
          </figure>
        ))}
      </div>
    </aside>
  );
}

/* ---------- Moon facts ---------- */
const LEFT_BEHIND = [
  ["🇺🇸", "American flags", "Six American flags were planted during Apollo missions between 1969 and 1972."],
  ["👣", "Astronaut footprints", "Footprints are still on the Moon because there is no wind or rain to wash them away."],
  ["🚙", "Moon cars", "NASA left three electric lunar rovers on the Moon (Apollo 15, 16 and 17). Astronauts used them to travel across the surface."],
  ["🚀", "Spacecraft parts", "The bottom sections of the lunar landing spacecraft were left behind."],
  ["🔬", "Scientific instruments", "Astronauts left equipment to measure moonquakes, temperature and other lunar conditions. Some experiments still provide scientific value."],
  ["💿", "Messages from Earth", "Apollo 11 left a tiny silicon disc containing goodwill messages from world leaders."],
];
const OTHER = [
  ["India", "Chandrayaan-3 successfully landed near the Moon's south polar region in 2023."],
  ["USA", "Apollo 11 landed the first humans on the Moon in 1969."],
  ["Soviet Union", "Sent robotic spacecraft and the Lunokhod robotic moon rovers."],
  ["China", "Successfully landed robotic spacecraft and returned lunar samples to Earth."],
];
const FACTS = [
  "12 humans have walked on the Moon.",
  "No human has walked on the Moon since December 1972.",
  "Astronauts brought hundreds of kilograms of lunar rocks and soil back to Earth.",
  "The Moon has human-made objects, footprints, rover tracks and even discarded equipment and bags of waste.",
];

function Facts({ onClose }) {
  return (
    <div className="facts" onClick={onClose}>
      <div className="factsbox" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>What humans left on the Moon</h2>
        <ul className="cards">
          {LEFT_BEHIND.map(([e, t, d]) => (
            <li key={t}><span>{e}</span><div><b>{t}</b><p>{d}</p></div></li>
          ))}
        </ul>
        <h3>🌍 Other things humans have done</h3>
        <ul className="plain">{OTHER.map(([c, d]) => <li key={c}><b>{c}:</b> {d}</li>)}</ul>
        <h3>🤯 Some amazing facts</h3>
        <ul className="plain">{FACTS.map((f) => <li key={f}>{f}</li>)}</ul>
      </div>
    </div>
  );
}

/* ---------- Mars facts ---------- */
const MARS_ROBOTS = [
  ["Sojourner (1997)", "The first successful wheeled rover on Mars. It explored rocks and soil."],
  ["Spirit (2004)", "Explored Mars and discovered evidence that water once altered Martian rocks."],
  ["Opportunity (2004)", "Found strong evidence that liquid water existed on ancient Mars."],
  ["Curiosity (2012)", "Studies ancient environments, rocks, chemistry and the possibility that Mars once supported microbial life."],
  ["Zhurong (2021)", "China's Mars rover. Studied soil, rocks and evidence of ancient water."],
  ["Perseverance (2021)", "Searches for signs of ancient microbial life and collects rock samples."],
  ["Ingenuity (2021)", "The first powered aircraft to fly on another planet. Its flight mission ended in 2024."],
  ["Viking 1 and 2 (1976)", "Stationary landers that took pictures, studied soil and atmosphere and ran experiments searching for life."],
  ["Pathfinder (1997)", "Delivered Sojourner and used airbags for landing."],
  ["Phoenix (2008)", "Found water ice beneath the Martian soil."],
  ["InSight (2018)", "Measured marsquakes and investigated Mars' interior."],
  ["Mars 3 (1971)", "The Soviet lander transmitted for about 20 seconds after landing before communication stopped."],
];
const MARS_OTHER = ["Parachutes used during landings", "Heat shields that protected spacecraft from extreme heat", "Landing airbags used by Pathfinder", "Rocket-powered landing equipment", "Spacecraft backshells", "Broken or discarded scientific instruments", "Rover wheel tracks and landing marks", "Sample collection tubes left by Perseverance", "Small pieces of landing hardware and debris", "The Ingenuity helicopter and its landing equipment", "The remains of old landers and rovers"];
const MARS_ORBITERS = [
  ["Mariner 9 (USA)", "First spacecraft to orbit another planet."],
  ["Mars Global Surveyor (USA)", "Mapped the Martian surface in detail."],
  ["Mars Odyssey (USA)", "Detected evidence of water-related hydrogen beneath the surface."],
  ["Mars Reconnaissance Orbiter (USA)", "Takes extremely detailed images and helps relay rover communications."],
  ["Mars Express (Europe)", "Investigates Mars, its atmosphere and subsurface."],
  ["MAVEN (USA)", "Studies how Mars lost much of its atmosphere."],
  ["Mangalyaan (India)", "India's first Mars orbiter. Its mission ended in 2022."],
  ["Hope (UAE)", "Studies the Martian atmosphere and weather."],
  ["Tianwen-1 (China)", "Delivered the Zhurong rover and studies Mars from orbit."],
  ["Trace Gas Orbiter (Europe/Russia)", "Studies atmospheric gases, including methane."],
];
const MARS_FOUND = [
  ["Ancient rivers", "Mars once had rivers, lakes and flowing water. Scientists have found dried river channels and ancient lake deposits."],
  ["Water ice", "Water ice exists at the Martian poles and underground in various regions."],
  ["Ancient lakes", "Some Martian craters once contained lakes that may have lasted a very long time."],
  ["Strange round rocks", "Opportunity found tiny rounded mineral formations nicknamed 'blueberries'. They formed through water-related processes."],
  ["Organic molecules", "Organic molecules have been detected in Martian rocks. They are ingredients of chemistry associated with life, but they do not prove life existed."],
  ["Giant dust storms", "Dust storms can sometimes spread across much of the planet."],
  ["Olympus Mons", "The largest known volcano in the solar system is on Mars."],
  ["Valles Marineris", "A gigantic canyon system stretching thousands of kilometres across Mars."],
];
const MARS_MYSTERY = [
  ["The Face on Mars", "A hill that looked like a human face in an old photograph. Better images showed it is a natural landform."],
  ["Martian spiders", "Spider-like patterns formed by seasonal carbon dioxide processes."],
  ["Dark streaks", "Strange dark lines on slopes. Scientists have investigated whether salts, dust and other processes explain them."],
  ["Blue sunsets", "Mars can have bluish sunsets because its dusty atmosphere scatters light."],
  ["Methane mystery", "Curiosity has detected methane near its location. Its source remains unexplained."],
  ["Meteorites", "Rovers have found iron-rich meteorites that fell from space onto Mars."],
];
const MARS_FAILED = ["Mars 2 (1971): Soviet lander crashed.", "Mars 3 (1971): Landed but stopped transmitting after around 20 seconds.", "Beagle 2 (2003): Reached Mars but failed to deploy fully.", "Schiaparelli (2016): Crashed during landing.", "Several other spacecraft failed during launch, cruise or arrival."];
const MARS_COUNTRIES = [["USA", "Multiple orbiters, landers, rovers and a helicopter"], ["Soviet Union", "Early Mars orbiters and landers"], ["India", "Mangalyaan Mars orbiter"], ["China", "Tianwen-1 orbiter, lander and Zhurong rover"], ["UAE", "Hope Mars orbiter"], ["Europe", "Mars Express and Trace Gas Orbiter"]];

function MarsFacts({ onClose }) {
  const cards = (rows) => (
    <ul className="cards">{rows.map(([t, d]) => <li key={t}><div><b>{t}</b><p>{d}</p></div></li>)}</ul>
  );
  const list = (rows) => <ul className="plain">{rows.map((t) => <li key={t}>{t}</li>)}</ul>;
  return (
    <div className="facts" onClick={onClose}>
      <div className="factsbox" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>Everything humans have left on Mars</h2>
        <h3>🤖 Robots and landers</h3>{cards(MARS_ROBOTS)}
        <h3>🧱 Other objects left on the surface</h3>{list(MARS_OTHER)}
        <p className="hint">Not every piece of debris has been individually photographed or identified. Some spacecraft also crashed, leaving impact sites and fragments.</p>
        <h3>🛰️ Spacecraft orbiting Mars</h3>{cards(MARS_ORBITERS)}
        <p className="hint">Some of these orbiters are still operating, while others have completed their missions.</p>
        <h3>🔭 What humans have discovered</h3>{cards(MARS_FOUND)}
        <h3>👽 Strange and mysterious things</h3>{cards(MARS_MYSTERY)}
        <p className="hint">None of these discoveries proves that aliens or intelligent life have been found on Mars.</p>
        <h3>🧬 Have humans found life on Mars?</h3>
        {list(["Mars once had liquid water on its surface.", "Ancient Mars had environments that could have supported microbial life.", "Scientists have found organic molecules.", "Perseverance is investigating rocks that could preserve signs of ancient life.", "No confirmed Martian organism, fossil or living microorganism has been discovered. Could there have been tiny bacteria billions of years ago? Possibly. We do not know yet."])}
        <h3>🌑 The two moons of Mars</h3>
        {cards([["Phobos", "The larger moon. It orbits extremely close to Mars and is slowly moving inward."], ["Deimos", "The smaller, more distant moon. It has an irregular shape."]])}
        <p className="hint">Spacecraft have photographed both moons from nearby, but none has landed on either.</p>
        <h3>💥 Things that failed on Mars</h3>{list(MARS_FAILED)}
        <h3>🌍 Which countries have explored Mars?</h3>
        <ul className="plain">{MARS_COUNTRIES.map(([c, d]) => <li key={c}><b>{c}:</b> {d}</li>)}</ul>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */
// `world` is "moon" or "mars" and is chosen by the navbar.
// Mount it with key={world} so the scene resets when the planet changes.
export default function SpaceExplorer({ world = "moon" }) {
  const sites = SITES; // site data lives in this file, so the spots show even if the backend is off
  const [selected, setSelected] = useState(null);
  const [showFacts, setShowFacts] = useState(false);
  const bodySites = sites.filter((x) => (x.body || "moon") === world);
  const [srcs, fallback] = TEXTURES[world];

  return (
    <div className={"space-app" + (selected ? " sel" : "")}>
      <header>
        <h1>{world === "moon" ? "What we left on the Moon" : "What we left on Mars"}</h1>
        <p>{world === "moon" ? "Tap a circle on the moon. Red: Apollo (USA). Blue: India, USSR and China. Drag to turn the moon and find the far-side sites." : "Tap a circle on Mars. Red: NASA. Blue: China. Amber: failed missions. Drag to turn the planet."}</p>
      </header>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6.5], fov: 45 }}>
        <Responsive />
        <color attach="background" args={["#05060a"]} />
        <Stars radius={80} depth={40} count={4000} factor={3} fade />
        <ambientLight intensity={1.2} />
        <Headlight />
        <Moon key={world} srcs={srcs} fallback={fallback} sites={bodySites} selected={selected} onSelect={setSelected} />
        <OrbitControls enablePan={false} minDistance={2.6} maxDistance={20} enableDamping />
      </Canvas>
      <button className="factsbtn" onClick={() => setShowFacts(true)}>{world === "moon" ? "Moon facts" : "Mars facts"}</button>
      {showFacts && (world === "moon" ? <Facts onClose={() => setShowFacts(false)} /> : <MarsFacts onClose={() => setShowFacts(false)} />)}
      <nav className="sites">
        {bodySites.map((x) => (
          <button key={x.id} className={selected?.id === x.id ? "on" : ""} onClick={() => setSelected(x)}>
            {x.name.split(" – ")[0]}
          </button>
        ))}
      </nav>
      {selected && <Panel site={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}