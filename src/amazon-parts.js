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

const pageSize=10;
const parts=Object.entries(partsByYear).flatMap(([year,entries])=>entries.map(([name,description])=>({year,name,description})));
const pageCount=Math.ceil(parts.length/pageSize);

function pageUrl(page,vehicle){
 const query=vehicle?'/'+encodeURIComponent(vehicle):'';
 return '#amazon-parts'+(page===1&&!vehicle?'':'/'+page+query);
}

export function amazonPartsPage({layout,esc,pageId,vehicleId}){
 const requested=Number(pageId);
 const page=Number.isInteger(requested)&&requested>=1&&requested<=pageCount?requested:1;
 let vehicle='';
 try{vehicle=decodeURIComponent(vehicleId||'').trim().slice(0,100)}catch{}
 const start=(page-1)*pageSize;
 const cards=parts.slice(start,start+pageSize).map(({year,name,description})=>{
  const url='https://www.amazon.com/s?k='+encodeURIComponent(['automotive',name,vehicle].filter(Boolean).join(' '))+'&tag=andresvalde06-20';
  return `<article class="offer-card amazon-part-card"><div class="offer-kind">${year}</div><h2>${esc(name)}</h2><p>${esc(description)}</p><p class="amazon-stock">Stock quantity: Check on Amazon</p><a class="secondary" href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener noreferrer" data-analytics-link="partner_click">Check price and availability ↗</a></article>`;
 }).join('');
 const numbers=Array.from({length:pageCount},(_,index)=>{
  const number=index+1;
  return number===page?`<span aria-current="page">${number}</span>`:`<a href="${pageUrl(number,vehicle)}" aria-label="Page ${number}">${number}</a>`;
 }).join('');
 const back=page>1?`<a class="secondary" href="${pageUrl(page-1,vehicle)}">← Back</a>`:'<a class="secondary" href="#home">← Back to marketplace</a>';
 layout(`<section class="section amazon-parts"><h1>Amazon Auto Parts Guide</h1>${back}<p>Explore maintenance and repair categories for 2026 and 2027. Confirm fitment and stock for the specific listing before ordering.</p><p>As an Amazon Associate I earn from qualifying purchases.</p>
 <form id="amazon-vehicle" class="amazon-vehicle"><label for="amazon-vehicle-query">Car or truck (year, make, model and engine)</label><input id="amazon-vehicle-query" name="vehicle" type="search" maxlength="100" value="${esc(vehicle)}" placeholder="Example: 2011 Ram 1500 5.7L"><button class="primary" type="submit">Apply vehicle</button></form>
 <div class="offer-grid amazon-parts-grid">${cards}</div><nav class="amazon-pagination" aria-label="Amazon auto parts pages">${numbers}</nav></section>`,{showBack:false});
 const form=document.getElementById('amazon-vehicle');
 form?.addEventListener('submit',event=>{
  event.preventDefault();
  const selected=new FormData(form).get('vehicle').trim();
  window.location.hash=pageUrl(page,selected);
 });
}
