const partsByYear = {
  "2026": [
    [
      "Engine oil filter",
      "Traps debris in engine oil."
    ],
    [
      "Engine air filter",
      "Keeps dirt out of the intake."
    ],
    [
      "Cabin air filter",
      "Filters incoming cabin air."
    ],
    [
      "Wiper blades",
      "Match blade length and arm fitting."
    ],
    [
      "Brake pads",
      "Confirm axle and brake package."
    ],
    [
      "Brake rotors",
      "Compare diameter, thickness and axle."
    ],
    [
      "Starter battery",
      "Match group size and battery technology."
    ],
    [
      "Spark plugs",
      "Check specified heat range and gap."
    ],
    [
      "Ignition coil",
      "Match connector and engine."
    ],
    [
      "Serpentine belt",
      "Confirm length and accessory layout."
    ],
    [
      "Belt tensioner",
      "Maintains accessory belt tension."
    ],
    [
      "Alternator",
      "Match amperage and connector."
    ],
    [
      "Starter motor",
      "Confirm engine and transmission fit."
    ],
    [
      "Engine thermostat",
      "Match temperature rating and housing."
    ],
    [
      "Water pump",
      "Circulates coolant. Check included seals."
    ],
    [
      "Radiator",
      "Match dimensions and cooler connections."
    ],
    [
      "Upper radiator hose",
      "Compare hose routing and diameters."
    ],
    [
      "Fuel pump module",
      "Check tank capacity and connector."
    ],
    [
      "Wheel hub assembly",
      "Match axle, bolt pattern and ABS setup."
    ],
    [
      "Shock absorber",
      "Controls suspension bounce."
    ],
    [
      "Complete strut assembly",
      "Verify side and suspension trim."
    ],
    [
      "Sway bar end link",
      "Connects the stabilizer bar to the suspension."
    ],
    [
      "Outer tie rod end",
      "Links steering to the wheel knuckle."
    ],
    [
      "Oxygen sensor",
      "Check bank and upstream or downstream position."
    ],
    [
      "Transmission filter kit",
      "Match transmission code and pan gasket."
    ]
  ],
  "2027": [
    [
      "Brake caliper",
      "Clamps the pads against the rotor."
    ],
    [
      "Brake flex hose",
      "Carries brake fluid to the wheel brake."
    ],
    [
      "ABS wheel speed sensor",
      "Match connector and mounting position."
    ],
    [
      "CV axle assembly",
      "Check side, drivetrain and splines."
    ],
    [
      "Lower control arm",
      "Confirm side and included bushings."
    ],
    [
      "Suspension ball joint",
      "Verify position and installation type."
    ],
    [
      "Engine mount",
      "Supports the engine and reduces vibration."
    ],
    [
      "Transmission mount",
      "Check dimensions and drivetrain fit."
    ],
    [
      "Valve cover gasket set",
      "Seals the top of the cylinder head."
    ],
    [
      "Intake manifold gasket",
      "Match gasket shape and engine code."
    ],
    [
      "Ignition coil wiring harness",
      "Compare connectors and pin counts."
    ],
    [
      "Fuel injector",
      "Verify the part number and fuel system."
    ],
    [
      "EVAP purge valve",
      "Match electrical plug and hose ports."
    ],
    [
      "Mass airflow sensor",
      "Measures incoming air. Check housing style."
    ],
    [
      "Crankshaft position sensor",
      "Match engine code and connector."
    ],
    [
      "Camshaft position sensor",
      "Check bank and intake or exhaust position."
    ],
    [
      "Engine coolant temperature sensor",
      "Verify connector and threads."
    ],
    [
      "Radiator cooling fan assembly",
      "Check plugs and shroud dimensions."
    ],
    [
      "Coolant expansion tank",
      "Match fittings and sensor provisions."
    ],
    [
      "Heater blower motor",
      "Moves air through the cabin vents."
    ],
    [
      "Blower motor resistor",
      "Controls blower speed on compatible vehicles."
    ],
    [
      "A/C compressor",
      "Match compressor model and connections."
    ],
    [
      "Door lock actuator",
      "Confirm door position and connector."
    ],
    [
      "Window regulator",
      "Match door position and motor configuration."
    ],
    [
      "Hood lift support",
      "Match length and end fittings."
    ]
  ]
};

export function amazonPartsPage({layout,esc}){
 const sections=Object.entries(partsByYear).map(([year,parts])=>{
  const title=year==='2026'?'2026 maintenance and replacement priorities':'2027 parts to watch';
  const cards=parts.map(([part,description])=>{
   const url='https://www.amazon.com/s?k='+encodeURIComponent('automotive '+part)+'&tag=andresvalde06-20';
   return `<article class="offer-card"><h3>${esc(part)}</h3><p>${esc(description)}</p><a class="secondary" href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener noreferrer" data-analytics-link="partner_click">Compare prices on Amazon ↗</a></article>`;
  }).join('');
  return `<section class="section offers"><h2>${title}</h2><div class="offer-grid">${cards}</div></section>`;
 }).join('');
 layout(`<section class="section"><h1>Amazon Auto Parts Guide</h1><p>Explore 50 common maintenance and repair categories. The 2027 list is a planning guide. Check your year, make, model and engine before ordering.</p><p>As an Amazon Associate I earn from qualifying purchases.</p></section>${sections}`);
}
