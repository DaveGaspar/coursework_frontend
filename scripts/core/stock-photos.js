// Freely licensed stadium photos bundled with the site, shown when a match has no photo or the photo host is down.
const PHOTOS = [
  ['stadium-night.jpg', 'Krzysztof Popławski, CC BY 4.0',
    'https://commons.wikimedia.org/wiki/File:Mecz_pi%C5%82karski_Wis%C5%82a_Krak%C3%B3w_-_Zag%C5%82%C4%99bie_Sosnwoiec,_28_pa%C5%BAdziernika_2022,_Po%C5%BCegnanie_Stadionu_Ludowego,_KP.jpg'],
  ['stadium-yellow-wall.jpg', 'Markus Unger, CC BY 2.0',
    'https://commons.wikimedia.org/wiki/File:2012-02-26_Dortmund01_(6791756854).jpg'],
  ['stadium-floodlights.jpg', 'Der-wuppertaler, CC BY-SA 3.0',
    'https://commons.wikimedia.org/wiki/File:GER_Dortmund_Stadion_002_2011_-_S%C3%BCdtrib%C3%BCne.jpg'],
  ['stadium-pitch.jpg', 'Paul Gillett, CC BY-SA 2.0',
    'https://commons.wikimedia.org/wiki/File:Groundsmen_at_Wembley_Stadium_-_geograph.org.uk_-_4624461.jpg'],
  ['stadium-celebration.jpg', 'Terry Robinson, CC BY-SA 2.0',
    'https://commons.wikimedia.org/wiki/File:Isn%27t_Wembley_a_No_Smoking_Stadium%5E_-_geograph.org.uk_-_1873256.jpg'],
];

// The same seed (a match id) always gets the same photo.
export function stockPhoto(seed = 0) {
  const [file, label, url] = PHOTOS[Math.abs(Math.trunc(Number(seed) || 0)) % PHOTOS.length];
  return { src: new URL(`../../assets/img/stadiums/${file}`, import.meta.url).href, credit: { label, url } };
}

// Swaps a remote photo for the bundled one if it fails to load; onSwap receives the new credit.
export function fallBackToStock(img, seed, onSwap) {
  img.addEventListener('error', () => {
    const stock = stockPhoto(seed);
    img.src = stock.src;
    onSwap?.(stock.credit);
  }, { once: true });
}
