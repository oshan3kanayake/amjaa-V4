// ─────────────────────────────────────────────────────────────
// defaults.js — starter content.
//  • The public sites fall back to this if Firestore is empty/offline,
//    so a fresh deploy never looks broken.
//  • The admin panel's "Load starter data" button writes exactly this
//    into Firestore, after which EVERYTHING is edited in the admin.
// ─────────────────────────────────────────────────────────────
const U = (id, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export const DEFAULT_SITE = {
  brandInbound:  'Amja Tours',
  brandOutbound: 'Amja Travels',
  legalName:     'Amja Travels (Pvt) Ltd',
  since:         1998,
  taglineInbound:  'Sri Lanka, the way locals know it.',
  taglineOutbound: 'The world, from Colombo.',
  aboutTitle: 'A Colombo family business that has been moving people since 1998.',
  aboutText:  'Amja started with a single desk in Colombo 12 and a simple promise: every traveller is looked after by a real person, from the first call to the last transfer. More than two decades later we are IATA accredited, TAASL members and approved by the Civil Aviation Authority — but we still answer the phone ourselves.',
  phone:   '+94 11 233 5657',
  phone2:  '+94 77 730 8079',
  whatsapp:'+94777308079',
  email:   'amjatrvl@sltnet.lk',
  address: 'No. 30, Dias Place, Gunasinghapura, Colombo 12, Sri Lanka',
  hours:   'Monday – Saturday · 8:30 AM – 5:30 PM',
  mapQuery:'Dias Place, Colombo 12, Sri Lanka',
  facebook:'https://www.facebook.com/amjatravels/',
  instagram:'',
  youtube: 'https://www.youtube.com/channel/UCwWbAdW1H5Xb99yLWRk8tBA',
  x:       'https://twitter.com/amja_travels',
  tiktok:  '',
  inboundUrl:  'https://amjaa-travels.web.app',
  outboundUrl: 'https://amjaa-travels-outbound.web.app',
  accreditations: ['IATA Accredited Agent', 'TAASL Member', 'Civil Aviation Authority Approved'],
  stats: [
    { value: 27,    suffix: '+', label: 'Years in travel' },
    { value: 40000, suffix: '+', label: 'Travellers looked after' },
    { value: 13,    suffix: '',  label: 'Island destinations' },
    { value: 24,    suffix: '/7', label: 'Real-person support' },
  ],
};

/* ── Inbound: hotels (multiple images each) ───────────────── */
export const DEFAULT_HOTELS = [
  { name: 'Galaxy Grand Hotel', city: 'Nuwara Eliya', location: 'Nuwara Eliya · Hill Country', stars: 4, category: 'Our hotel', featured: true, order: 1,
    description: 'Our own hotel in the misty tea highlands of "Little England" — colonial charm, warm Sri Lankan hospitality and tea-country views, minutes from Gregory Lake and the racecourse.',
    price: 'Best rate direct', booking_url: '',
    amenities: ['Tea-country views', 'Restaurant', 'Family rooms', 'Free Wi-Fi', 'Parking', 'Tour desk'],
    images: ['images/photo/hotel-1.jpeg', 'images/photo/hotel-2.jpeg', 'images/photo/hotel-3.jpeg', 'images/photo/hotel-4.jpeg', 'images/photo/hotel-5.jpeg'],
    videos: ['images/photo/hotel-video-1.mp4', 'images/photo/hotel-video-2.mp4'], ownHotel: true },
  { name: 'Eden Resort & Spa', city: 'Bentota', location: 'Beruwala · West Coast', stars: 5, category: 'Beach resort', featured: true, order: 2,
    description: 'A five-star beachfront resort on the golden west coast with a full spa, lagoon-style pools and fine dining.',
    price: 'From LKR 38,000 / night', booking_url: '',
    amenities: ['Beachfront', 'Spa', 'Pools', 'Fine dining', 'Water sports'],
    images: ['images/photo/home-eden.jpg', U('photo-1571896349842-33c89424de2d'), U('photo-1582719508461-905c673771fd'), U('photo-1590490360182-c33d57733427')] },
  { name: 'Aditya Resort', city: 'Galle', location: 'Rathgama · South Coast', stars: 5, category: 'Boutique', featured: true, order: 3,
    description: 'Boutique luxury on the south coast — private, intimate and close to Galle Fort.',
    price: 'From LKR 45,000 / night', booking_url: '',
    amenities: ['Private villas', 'Ocean view', 'Infinity pool', 'Ayurveda'],
    images: ['images/photo/home-aditya.jpg', U('photo-1584132967334-10e028bd69f7'), U('photo-1566073771259-6a8506099945')] },
  { name: 'Mahaweli Reach', city: 'Kandy', location: 'Kandy · Hill Capital', stars: 5, category: 'City & river', featured: false, order: 4,
    description: 'Riverside elegance in the hill capital, a short drive from the Temple of the Tooth.',
    price: 'From LKR 32,000 / night', booking_url: '',
    amenities: ['Riverside', 'Pool', 'Near the Temple', 'Spa'],
    images: ['images/photo/home-mahawali.jpg', U('photo-1520250497591-112f2f40a3f4'), U('photo-1611892440504-42a792e24d32')] },
  { name: 'Deer Park Hotel', city: 'Polonnaruwa', location: 'Giritale · Cultural Triangle', stars: 4, category: 'Nature', featured: false, order: 5,
    description: 'Cottages set in forest above the Giritale tank — the calm base for Polonnaruwa, Sigiriya and Minneriya.',
    price: 'From LKR 26,000 / night', booking_url: '',
    amenities: ['Nature', 'Pool', 'Lake views', 'Cultural triangle'],
    images: [U('photo-1566073771259-6a8506099945'), U('photo-1542314831-068cd1dbfeeb'), U('photo-1551882547-ff40c63fe5fa')] },
];

/* ── Inbound: rent a car (multiple images each) ───────────── */
export const DEFAULT_FLEET = [
  { name: 'Mini Car', category: 'Mini Car', model: 'Mazda Demio or similar', seats: 4, luggage: 2, transmission: 'Automatic', fuel: 'Petrol', ac: true, withDriver: 'Self-drive or chauffeur', price: 'On request', order: 1,
    description: 'Economical and easy to park — ideal for Colombo and couples.', features: ['Budget', 'Easy parking', 'Bluetooth'],
    images: [U('photo-1541899481282-d53bffe3c35d'), U('photo-1549317661-bd32c8ce0db2')] },
  { name: 'Standard Sedan', category: 'Standard Car', model: 'Nissan Sunny or similar', seats: 4, luggage: 2, transmission: 'Automatic', fuel: 'Petrol', ac: true, withDriver: 'Self-drive or chauffeur', price: 'On request', order: 2,
    description: 'A comfortable, reliable car for everyday travel and airport runs.', features: ['Value', 'Airport runs'],
    images: [U('photo-1549317661-bd32c8ce0db2'), U('photo-1550355291-bbee04a92027')] },
  { name: 'Executive Sedan', category: 'Executive Car', model: 'Toyota Allion / Premio', seats: 4, luggage: 3, transmission: 'Automatic', fuel: 'Hybrid', ac: true, withDriver: 'Chauffeur driven', price: 'On request', order: 3,
    description: 'A refined sedan for business travel and long island tours.', features: ['Hybrid', 'Executive', 'Long tours'],
    images: [U('photo-1552519507-da3b142c6e3d'), U('photo-1550355291-bbee04a92027')] },
  { name: 'Luxury Saloon', category: 'Luxury Car', model: 'BMW 5 Series or similar', seats: 4, luggage: 3, transmission: 'Automatic', fuel: 'Diesel', ac: true, withDriver: 'Chauffeur driven', price: 'On request', order: 4,
    description: 'Premium saloon for VIP transfers, weddings and special occasions.', features: ['VIP transfer', 'Weddings', 'Premium'],
    images: [U('photo-1555215695-3004980ad54e'), U('photo-1552519507-da3b142c6e3d')] },
  { name: 'Mini SUV 4×4', category: 'SUV', model: 'Hyundai Tucson or similar', seats: 5, luggage: 3, transmission: 'Automatic', fuel: 'Diesel', ac: true, withDriver: 'Self-drive or chauffeur', price: 'On request', order: 5,
    description: 'Compact 4×4 for hill-country roads and light off-road.', features: ['4WD', 'Hill country', 'Family'],
    images: [U('photo-1519641471654-76ce0107ad1b'), U('photo-1533473359331-0135ef1b58bf')] },
  { name: 'Land Cruiser Prado', category: 'SUV', model: 'Toyota Prado / Land Cruiser', seats: 7, luggage: 4, transmission: 'Automatic', fuel: 'Diesel', ac: true, withDriver: 'Chauffeur driven', price: 'On request', order: 6,
    description: 'Spacious premium 4×4 for safaris, VIP groups and rough terrain.', features: ['Safari', 'VIP', 'Premium 4WD'],
    images: ['images/photo/fleet-hero-new.jpg', U('photo-1533473359331-0135ef1b58bf'), U('photo-1594502184342-2e12f877aa73')] },
  { name: 'Family Minivan', category: 'Van', model: 'Toyota KDH high-roof', seats: 12, luggage: 8, transmission: 'Manual', fuel: 'Diesel', ac: true, withDriver: 'Chauffeur driven', price: 'On request', order: 7,
    description: 'High-roof van for large families, pilgrimages and group tours.', features: ['Groups', 'Tours', 'Luggage space'],
    images: [U('photo-1543465077-db45d34b88a5'), U('photo-1558618666-fcd25c85cd64')] },
];

/* ── Inbound: tour planner (expert system) ───────────────────
   Same model as the original expert system — but nothing is
   hard-wired: hubs = any city with an airport code, budget bands,
   interests and night options are all edited in the admin. */
export const DEFAULT_RULES = {
  transportPerKm: 260, guidePerDay: 8000, activityPerPerson: 2000, markupPercent: 10,
  maxTripDays: 30, maxKmPerDay: 300, defaultInterests: 'nature, culture, beach',
  tierStandard: 12000, tierBoutique: 18000, tierFiveStar: 20000, tierDeluxe: 25000, tierVilla: 30000,
  mealBreakfast: 1500, mealHalfBoard: 3500, mealFullBoard: 5000, mealAllInclusive: 7000,
  cityLimits: [ { days: 3, cities: 1 }, { days: 5, cities: 2 }, { days: 7, cities: 3 }, { days: 10, cities: 4 }, { days: 14, cities: 6 } ],
  budgetBands: [
    { label: 'Essential', amount: 25000, note: 'Comfortable & great value' },
    { label: 'Signature', amount: 45000, note: 'Our most chosen style' },
    { label: 'Indulgent', amount: 90000, note: 'Nothing left to chance' },
  ],
  displayCurrency: 'USD', fxRate: 300,
};

const ALL = [3, 5, 7, 10, 14], MID = [5, 7, 10, 14], LONG = [7, 10, 14];
export const DEFAULT_CITIES = [
  { order: 1,  title: 'Colombo',      region: 'Western Coast',   airportCode: 'cmb', emoji: '🏙️', lat: 6.9271, lng: 79.8612, tiers: ALL, interests: ['culture', 'shopping', 'food'], image: U('photo-1586861635167-e5223aadc9fe'), description: "Sri Lanka's restless capital — colonial facades, Pettah's bazaars, sea-breeze evenings on Galle Face.", activities: ['Galle Face Green at sunset', 'Pettah market walk', 'Gangaramaya Temple', 'Colombo street-food trail'] },
  { order: 2,  title: 'Kandy',        region: 'Hill Capital',    emoji: '🛕', lat: 7.2906, lng: 80.6337, tiers: ALL, interests: ['culture', 'heritage', 'nature'], image: 'images/dest-sigiriya.jpg', description: 'The last royal capital — the Temple of the Tooth, a lake at its heart and hills all around.', activities: ['Temple of the Tooth', 'Kandy Lake stroll', 'Peradeniya Botanical Gardens', 'Kandyan dance show'] },
  { order: 3,  title: 'Sigiriya',     region: 'Cultural Triangle', emoji: '🦁', lat: 7.9570, lng: 80.7603, tiers: ALL, interests: ['culture', 'heritage', 'adventure'], image: 'images/service-inbound.jpg', description: 'The Lion Rock fortress, 200 m above the jungle — a UNESCO World Heritage site.', activities: ['Climb Sigiriya Rock', 'Pidurangala sunrise hike', 'Village safari & lunch'] },
  { order: 4,  title: 'Dambulla',     region: 'Cultural Triangle', emoji: '🏯', lat: 7.8731, lng: 80.7718, tiers: MID, interests: ['culture', 'heritage'], image: U('photo-1578662996442-48f60103fc96'), description: 'Five painted caves with more than 150 Buddha statues, carved into a granite outcrop.', activities: ['Dambulla Cave Temple', 'Rangiri lake boat ride', 'Local produce market'] },
  { order: 5,  title: 'Polonnaruwa',  region: 'Ancient Kingdom', emoji: '🏛️', lat: 7.9399, lng: 81.0000, tiers: MID, interests: ['culture', 'heritage', 'nature'], image: U('photo-1588598198321-9735fd52455b'), description: 'A medieval royal city of ruins, reservoirs and the serene Gal Vihara statues.', activities: ['Ruins by bicycle', 'Gal Vihara', 'Minneriya elephant gathering'] },
  { order: 6,  title: 'Nuwara Eliya', region: 'Tea Hills',       emoji: '🍵', lat: 6.9497, lng: 80.7891, tiers: MID, interests: ['nature', 'culture'], image: U('photo-1546708973-b339540b5155'), description: '"Little England" at 1,800 m — tea estates, cool air and our own Galaxy Grand Hotel.', activities: ['Tea factory & tasting', 'Gregory Lake', 'Horton Plains & World\'s End'] },
  { order: 7,  title: 'Ella',         region: 'Mountain South',  emoji: '🌿', lat: 6.8667, lng: 81.0466, tiers: MID, interests: ['nature', 'adventure'], image: 'images/dest-highlands.jpg', description: 'The Nine Arch Bridge, Little Adam\'s Peak and the most beautiful train ride in Asia.', activities: ['Nine Arch Bridge', "Little Adam's Peak", 'Kandy–Ella scenic train', 'Ravana Falls'] },
  { order: 8,  title: 'Yala',         region: 'Wild South',      emoji: '🐆', lat: 6.3768, lng: 81.3969, tiers: LONG, interests: ['wildlife', 'nature', 'adventure'], image: 'images/dest-wildlife.jpg', description: 'The highest density of leopards on Earth, plus elephants, crocodiles and wild coast.', activities: ['Dawn jeep safari', 'Leopard tracking', 'Kataragama evening puja'] },
  { order: 9,  title: 'Udawalawe',    region: 'South Safari',    emoji: '🐘', lat: 6.4731, lng: 80.8997, tiers: LONG, interests: ['wildlife', 'nature'], image: U('photo-1585016495481-91613a3ab1bc'), description: 'Herds of wild elephants around a great reservoir — the surest elephant safari on the island.', activities: ['Elephant safari', 'Elephant Transit Home', 'Reservoir birdwatching'] },
  { order: 10, title: 'Mirissa',      region: 'South Coast',     emoji: '🐋', lat: 5.9483, lng: 80.4572, tiers: MID, interests: ['beach', 'wildlife'], image: 'images/photo/home-beach.jpg', description: 'Palm-lined bay famous for blue-whale watching and long, lazy evenings.', activities: ['Blue whale cruise', 'Parrot Rock sunrise', 'Coconut Tree Hill'] },
  { order: 11, title: 'Galle',        region: 'Southern Coast',  emoji: '⚓', lat: 6.0535, lng: 80.2210, tiers: ALL, interests: ['culture', 'heritage', 'beach'], image: 'images/photo/inbound-hero.jpg', description: 'A living Dutch fort city of ramparts, galleries and a lighthouse over the Indian Ocean.', activities: ['Galle Fort walk', 'Ramparts at sunset', 'Turtle hatchery'] },
  { order: 12, title: 'Bentota',      region: 'West Coast',      emoji: '🌊', lat: 6.4277, lng: 79.9981, tiers: ALL, interests: ['beach', 'nature'], image: U('photo-1552465011-b4e21bf6e79a'), description: 'Golden beaches, river safaris and water sports on the west coast.', activities: ['Madu River safari', 'Jet ski & banana boat', 'Brief Garden'] },
  { order: 13, title: 'Trincomalee',  region: 'East Coast',      emoji: '🏖️', lat: 8.5874, lng: 81.2152, tiers: LONG, interests: ['beach', 'culture', 'wildlife'], image: U('photo-1559628233-100c798642d4'), description: 'A deep natural harbour, Koneswaram on the cliff and the calm turquoise water of Nilaveli.', activities: ['Pigeon Island snorkel', 'Koneswaram Temple', 'Dolphin watching'] },
  { order: 14, title: 'Mattala (HRI)', region: 'Deep South',     airportCode: 'hri', hubOnly: true, emoji: '✈️', lat: 6.2870, lng: 81.1230, tiers: [], interests: ['transit'], image: '', description: 'Mattala Rajapaksa International Airport — southern gateway.', activities: [] },
];

/* ── Outbound: Hajj / Umrah / flight deals ────────────────── */
export const DEFAULT_HAJJ = [
  { title: 'Standard Hajj', tier: 'Standard', price: 'On request', duration: '30 – 35 days', order: 1, featured: false, image: 'images/photo/hajj-hero.jpg',
    makkahHotel: 'Aziziyah apartments', madinahHotel: '3★ near Markaziyah', departure: 'Colombo (CMB)',
    description: 'A complete, well-guided Hajj with shared Aziziyah accommodation and every rite arranged for you.',
    includes: ['Return airfare', 'Hajj visa', 'Mina & Arafat tents', 'Full board meals', 'Experienced Ulama', 'Ziyarah in Makkah & Madinah'] },
  { title: 'Premium Hajj', tier: 'Premium', price: 'On request', duration: '25 – 30 days', order: 2, featured: true, image: 'images/photo/home-makkah.jpg',
    makkahHotel: '4★ within walking distance', madinahHotel: '4★ Markaziyah', departure: 'Colombo (CMB)',
    description: 'Closer hotels, upgraded Mina tents and a dedicated group scholar for a calmer, more focused Hajj.',
    includes: ['Return airfare', 'Hajj visa', 'Upgraded Mina tents', 'Full board meals', 'Dedicated Ulama', 'A/C transport', 'Ziyarah'] },
  { title: 'VIP Hajj', tier: 'VIP', price: 'On request', duration: '18 – 22 days', order: 3, featured: false, image: 'images/service-hajj.jpg',
    makkahHotel: '5★ facing the Haram', madinahHotel: '5★ beside Masjid an-Nabawi', departure: 'Colombo (CMB)',
    description: 'Five-star hotels beside the Haramain, VIP Mina camp, private transport and concierge care throughout.',
    includes: ['Return airfare', 'Hajj visa', 'VIP Mina camp', 'Buffet full board', 'Private transport', 'Concierge', 'Ziyarah'] },
];
export const DEFAULT_UMRAH = [
  { title: 'Economy Umrah', tier: 'Economy', price: 'On request', duration: '10 days', order: 1, featured: false, image: 'images/photo/umrah-hero.jpg',
    makkahHotel: '3★ shuttle to Haram', madinahHotel: '3★ Markaziyah', departure: 'Colombo (CMB)',
    description: 'Guided Umrah with quality shared rooms and everything arranged from Colombo.',
    includes: ['Return airfare', 'Umrah visa', 'Breakfast & dinner', 'A/C transport', 'Ulama guidance'] },
  { title: 'Premium Umrah', tier: 'Premium', price: 'On request', duration: '12 days', order: 2, featured: true, image: 'images/photo/home-makkah.jpg',
    makkahHotel: '5★ steps from the Haram', madinahHotel: '5★ Markaziyah', departure: 'Colombo (CMB)',
    description: 'Five-star stays steps from the Masjid, full board and private transfers.',
    includes: ['Return airfare', 'Umrah visa', 'Full board', 'Private transfers', 'Ziyarah tours', 'Zamzam allowance'] },
  { title: 'Ramadan Umrah', tier: 'Ramadan', price: 'On request', duration: '15 – 20 days', order: 3, featured: false, image: 'images/photo/hajj-hero.jpg',
    makkahHotel: '4★ near the Haram', madinahHotel: '4★ Markaziyah', departure: 'Colombo (CMB)',
    description: 'The last ten nights in the Haramain, with Iftar and Suhoor arranged.',
    includes: ['Return airfare', 'Umrah visa', 'Iftar & Suhoor', 'A/C transport', 'Ulama guidance', 'Ziyarah'] },
];
export const DEFAULT_FLIGHTS = [
  { from: 'CMB', fromCity: 'Colombo', to: 'DXB', toCity: 'Dubai',     airline: 'Emirates / flydubai', fare: 'From LKR 92,000', trip: 'Return', order: 1, note: 'Daily departures' },
  { from: 'CMB', fromCity: 'Colombo', to: 'JED', toCity: 'Jeddah',    airline: 'Saudia / SriLankan',   fare: 'From LKR 118,000', trip: 'Return', order: 2, note: 'Umrah season' },
  { from: 'CMB', fromCity: 'Colombo', to: 'MLE', toCity: 'Malé',      airline: 'SriLankan',            fare: 'From LKR 68,000', trip: 'Return', order: 3, note: 'Resort transfers' },
  { from: 'CMB', fromCity: 'Colombo', to: 'SIN', toCity: 'Singapore', airline: 'Singapore Airlines',   fare: 'From LKR 110,000', trip: 'Return', order: 4, note: 'Onward connections' },
  { from: 'CMB', fromCity: 'Colombo', to: 'LHR', toCity: 'London',    airline: 'SriLankan / Qatar',    fare: 'From LKR 265,000', trip: 'Return', order: 5, note: 'Long haul' },
  { from: 'CMB', fromCity: 'Colombo', to: 'KUL', toCity: 'Kuala Lumpur', airline: 'Malaysia / AirAsia', fare: 'From LKR 74,000', trip: 'Return', order: 6, note: 'Family favourite' },
];

export const STARTER = {
  hotels: DEFAULT_HOTELS, fleet: DEFAULT_FLEET, expertCities: DEFAULT_CITIES,
  hajj_packages: DEFAULT_HAJJ, umrah_packages: DEFAULT_UMRAH, flight_deals: DEFAULT_FLIGHTS,
};
