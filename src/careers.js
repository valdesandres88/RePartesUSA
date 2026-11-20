const copy = {
  en: {
    title: 'Careers at RePartes USA',
    intro: 'Explore future roles on our auto parts marketplace team. Applications will open here when positions become available.',
    roles: [
      ['Bilingual Customer Support Specialist', 'Help buyers and sellers with orders, returns, and account questions in English and Spanish.'],
      ['Seller Onboarding Specialist', 'Help auto parts stores and salvage yards join the marketplace and publish their inventory.'],
      ['Auto Parts Catalog Specialist', 'Review listings, verify part numbers and vehicle fitment, and keep catalog details accurate.'],
      ['Shipping and Returns Coordinator', 'Track shipments and help buyers and sellers resolve delivery and return issues.'],
      ['Web Developer', 'Maintain the marketplace and improve search, checkout, and account tools.'],
      ['Marketing and Partnerships Specialist', 'Grow the marketplace through campaigns and partnerships with automotive businesses.'],
    ],
  },
  es: {
    title: 'Trabaja con RePartes USA',
    intro: 'Explora futuros puestos en nuestro marketplace de autopartes. Cuando se abran las vacantes, podrás postularte aquí.',
    roles: [
      ['Especialista bilingüe de atención al cliente', 'Ayuda a compradores y vendedores con pedidos, devoluciones y cuentas en español e inglés.'],
      ['Especialista de incorporación de vendedores', 'Ayuda a tiendas de autopartes y desguaces a unirse a la plataforma y publicar su inventario.'],
      ['Especialista de catálogo de autopartes', 'Revisa anuncios, verifica números de pieza y compatibilidad, y mantiene el catálogo actualizado.'],
      ['Coordinador de envíos y devoluciones', 'Da seguimiento a los envíos y ayuda a resolver problemas de entrega y devolución.'],
      ['Desarrollador web', 'Mantiene la plataforma y mejora la búsqueda, el proceso de compra y las herramientas de cuenta.'],
      ['Especialista de marketing y alianzas', 'Impulsa el marketplace con campañas y alianzas con negocios del sector automotriz.'],
    ],
  },
};

export function careersPage(language) {
  const {title, intro, roles} = copy[language] ?? copy.en;
  return `<section class="section" aria-labelledby="careers-title">
    <div class="eyebrow">Coming soon</div>
    <h1 id="careers-title">${title}</h1>
    <p>${intro}</p>
    <div class="part-tool-grid">
      ${roles.map(([role, description]) => `<article class="panel">
        <h2>${role}</h2>
        <p>${description}</p>
        <span class="eyebrow">Coming soon</span>
      </article>`).join('')}
    </div>
  </section>`;
}
