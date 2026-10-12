import type { Region } from './types'

/** Kraj → kontynent (kraina). Polskie i angielskie nazwy, porównywane bez wielkości liter i ogonków. */
const RAW: [Region, string[]][] = [
  ['EUROPE', ['Polska', 'Poland', 'Niemcy', 'Germany', 'Wielka Brytania', 'United Kingdom', 'UK', 'Anglia', 'England', 'Szkocja', 'Irlandia', 'Ireland',
    'Francja', 'France', 'Hiszpania', 'Spain', 'Portugalia', 'Portugal', 'Włochy', 'Italy', 'Holandia', 'Netherlands', 'Belgia', 'Belgium', 'Luksemburg',
    'Luxembourg', 'Szwajcaria', 'Switzerland', 'Austria', 'Czechy', 'Czech Republic', 'Czechia', 'Słowacja', 'Slovakia', 'Węgry', 'Hungary', 'Rumunia',
    'Romania', 'Bułgaria', 'Bulgaria', 'Grecja', 'Greece', 'Chorwacja', 'Croatia', 'Słowenia', 'Slovenia', 'Serbia', 'Dania', 'Denmark', 'Szwecja', 'Sweden',
    'Norwegia', 'Norway', 'Finlandia', 'Finland', 'Islandia', 'Iceland', 'Estonia', 'Łotwa', 'Latvia', 'Litwa', 'Lithuania', 'Ukraina', 'Ukraine', 'Malta', 'Cypr', 'Cyprus']],
  ['NORTH_AMERICA', ['USA', 'Stany Zjednoczone', 'United States', 'US', 'Kanada', 'Canada', 'Meksyk', 'Mexico', 'Kostaryka', 'Costa Rica', 'Panama']],
  ['SOUTH_AMERICA', ['Brazylia', 'Brazil', 'Argentyna', 'Argentina', 'Chile', 'Kolumbia', 'Colombia', 'Peru', 'Urugwaj', 'Uruguay', 'Ekwador', 'Ecuador', 'Wenezuela', 'Venezuela', 'Boliwia', 'Bolivia', 'Paragwaj', 'Paraguay']],
  ['MIDDLE_EAST', ['Arabia Saudyjska', 'Saudi Arabia', 'KSA', 'Saudi', 'Zjednoczone Emiraty Arabskie', 'ZEA', 'UAE', 'United Arab Emirates', 'Emiraty', 'Dubaj', 'Dubai',
    'Katar', 'Qatar', 'Kuwejt', 'Kuwait', 'Bahrajn', 'Bahrain', 'Oman', 'Jordania', 'Jordan', 'Izrael', 'Israel', 'Liban', 'Lebanon', 'Turcja', 'Turkey', 'Türkiye', 'Egipt', 'Egypt', 'Irak', 'Iraq']],
  ['AFRICA', ['RPA', 'South Africa', 'Nigeria', 'Kenia', 'Kenya', 'Maroko', 'Morocco', 'Ghana', 'Etiopia', 'Ethiopia', 'Tanzania', 'Rwanda', 'Tunezja', 'Tunisia', 'Algieria', 'Algeria', 'Senegal', 'Uganda']],
  ['ASIA', ['Japonia', 'Japan', 'Chiny', 'China', 'Korea Południowa', 'South Korea', 'Korea', 'Indie', 'India', 'Singapur', 'Singapore', 'Wietnam', 'Vietnam',
    'Tajlandia', 'Thailand', 'Indonezja', 'Indonesia', 'Malezja', 'Malaysia', 'Filipiny', 'Philippines', 'Tajwan', 'Taiwan', 'Hongkong', 'Hong Kong', 'Pakistan', 'Kazachstan', 'Kazakhstan']],
  ['OCEANIA', ['Australia', 'Nowa Zelandia', 'New Zealand']],
]

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

const INDEX = new Map<string, Region>()
for (const [region, names] of RAW) for (const n of names) INDEX.set(norm(n), region)

export function regionForCountry(country: string): Region | undefined {
  return country.trim() ? INDEX.get(norm(country)) : undefined
}

/** Podpowiedzi do pola „Kraj”. */
export const COUNTRY_SUGGESTIONS = RAW.flatMap(([, names]) => names).sort((a, b) => a.localeCompare(b, 'pl'))
