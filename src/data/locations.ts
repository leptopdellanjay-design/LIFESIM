export interface CountryLocationData {
  code: string;
  name: string;
  currencyCode: string;
  provinces: Record<string, string[]>;
}

export const supportedCountries: CountryLocationData[] = [
  {
    code: 'ID',
    name: 'Indonesia',
    currencyCode: 'IDR',
    provinces: {
      Aceh: ['Banda Aceh', 'Lhokseumawe', 'Sabang'],
      'Sumatera Utara': ['Medan', 'Binjai', 'Pematangsiantar'],
      'Sumatera Barat': ['Padang', 'Bukittinggi', 'Payakumbuh'],
      Riau: ['Pekanbaru', 'Dumai'],
      'Kepulauan Riau': ['Tanjungpinang', 'Batam'],
      Jambi: ['Jambi', 'Sungai Penuh'],
      'Sumatera Selatan': ['Palembang', 'Lubuklinggau', 'Prabumulih'],
      'Kepulauan Bangka Belitung': ['Pangkalpinang', 'Tanjung Pandan'],
      Bengkulu: ['Bengkulu'],
      Lampung: ['Bandar Lampung', 'Metro'],
      'DKI Jakarta': ['Jakarta'],
      'Jawa Barat': ['Bandung', 'Bekasi', 'Bogor', 'Cirebon', 'Depok', 'Sukabumi', 'Tasikmalaya'],
      'Jawa Tengah': ['Semarang', 'Magelang', 'Pekalongan', 'Salatiga', 'Surakarta', 'Tegal'],
      'DI Yogyakarta': ['Yogyakarta'],
      'Jawa Timur': ['Surabaya', 'Batu', 'Blitar', 'Kediri', 'Madiun', 'Malang', 'Mojokerto', 'Pasuruan', 'Probolinggo'],
      Banten: ['Serang', 'Cilegon', 'Tangerang Selatan', 'Tangerang'],
      Bali: ['Denpasar', 'Singaraja'],
      'Nusa Tenggara Barat': ['Mataram', 'Bima'],
      'Nusa Tenggara Timur': ['Kupang', 'Maumere'],
      'Kalimantan Barat': ['Pontianak', 'Singkawang'],
      'Kalimantan Tengah': ['Palangka Raya'],
      'Kalimantan Selatan': ['Banjarmasin', 'Banjarbaru'],
      'Kalimantan Timur': ['Samarinda', 'Balikpapan', 'Bontang'],
      'Kalimantan Utara': ['Tanjung Selor', 'Tarakan'],
      'Sulawesi Utara': ['Manado', 'Bitung', 'Tomohon'],
      Gorontalo: ['Gorontalo'],
      'Sulawesi Tengah': ['Palu'],
      'Sulawesi Barat': ['Mamuju'],
      'Sulawesi Selatan': ['Makassar', 'Palopo', 'Parepare'],
      'Sulawesi Tenggara': ['Kendari', 'Bau-Bau'],
      Maluku: ['Ambon', 'Tual'],
      'Maluku Utara': ['Sofifi', 'Ternate'],
      Papua: ['Jayapura'],
      'Papua Barat': ['Manokwari'],
      'Papua Selatan': ['Merauke'],
      'Papua Tengah': ['Nabire'],
      'Papua Pegunungan': ['Wamena'],
      'Papua Barat Daya': ['Sorong'],
    },
  },
];

export function getCountry(code: string): CountryLocationData | undefined {
  return supportedCountries.find((country) => country.code === code);
}

export function getProvinces(countryCode: string): string[] {
  const country = getCountry(countryCode);
  return country ? Object.keys(country.provinces) : [];
}

export function getCities(countryCode: string, province: string): string[] {
  const country = getCountry(countryCode);
  return country?.provinces[province] ?? [];
}

export function isSupportedLocation(countryCode: string, province: string, city: string): boolean {
  return getCities(countryCode, province).includes(city);
}
