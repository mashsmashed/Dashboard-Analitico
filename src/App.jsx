import { useEffect, useMemo, useState } from 'react'
import countries from './assets/countries.json'
import { CountryRankings, RegionalPie, TradeTrend } from './FoodCharts.jsx'
import { highColor, lowColor, tradeElements } from './foodBalance.js'
import './App.css'

// Natural Earth 1:110m boundaries, projected onto a fixed equirectangular map.
const countryShapes = countries.map(({ polygons, ...country }) => ({
  ...country,
  path: polygons.flatMap((polygon) =>
    polygon.map((ring) =>
      'M' + ring.map(([longitude, latitude]) =>
        `${(longitude + 180).toFixed(2)},${(90 - latitude).toFixed(2)}`
      ).join('L') + 'Z'
    )
  ).join(' '),
}))

const api = '/api/food-balance'
const numberFormat = new Intl.NumberFormat()
const missingColor = '#c2cbd2'

function useApi(url) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!url) return
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error('The API returned an error.')
        const data = await response.json()
        if (!controller.signal.aborted) setResult({ url, data })
      } catch {
        if (!controller.signal.aborted) setResult({ url, error: true })
      }
    }

    load()
    return () => controller.abort()
  }, [url])

  return result?.url === url ? result : null
}

function Filter({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

function formatValue(value) {
  return value == null ? 'No data' : numberFormat.format(value)
}

function FoodMeasures({ result, elements, countryId }) {
  if (result === null) return <p role="status">Loading…</p>
  if (result.error) return <p role="status">Could not load food balance data.</p>

  const rows = countryId
    ? result.data.rows.filter((row) => row.mapId === countryId)
    : result.data.rows
  const values = new Map(rows.map((row) => [row.Element, row.Value]))
  if (!values.size) return <p>No data for this product and year.</p>

  return (
    <dl className="food-measures">
      {elements.map((element) => (
        <div key={element}>
          <dt>{element}</dt>
          <dd>{formatValue(values.get(element))}</dd>
        </div>
      ))}
    </dl>
  )
}

function App() {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [item, setItem] = useState('Cereals - Excluding Beer')
  const [preferredYear, setYear] = useState('2023')
  const [mapElement, setMapElement] = useState('Import quantity')

  const options = useApi(api + '/options')
  const product = useApi(api + '/product?' + new URLSearchParams({ item }))
  const history = product?.data
  const years = history?.years ?? []
  const year = years.includes(Number(preferredYear)) ? preferredYear : String(years.at(-1) ?? '')
  const current = history?.byYear[year]
  const world = history ? { data: { rows: current?.world ?? [] } } : product
  const map = history ? { data: { rows: current?.countries ?? [] } } : product
  const regional = history
    ? { data: { rows: (current?.regions ?? []).filter((row) => row.Element === mapElement) } }
    : product
  const selectedCountryId = selectedCountry?.id
  const tradeRows = useMemo(() => {
    if (!history || !selectedCountryId) return []
    return Object.values(history.byYear).flatMap(({ countries }) =>
      countries.filter((row) => row.mapId === selectedCountryId && tradeElements.includes(row.Element))
    )
  }, [history, selectedCountryId])
  const trend = history ? { data: { rows: tradeRows } } : product
  const yearError = product?.error || (history && !years.length)
  const elements = options?.data?.element
    ?? ['Import quantity', 'Export quantity', 'Domestic supply quantity', 'Food']
  const values = new Map(
    (map?.data?.rows ?? [])
      .filter((row) => row.mapId && row.Element === mapElement)
      .map((row) => [row.mapId, row.Value])
  )
  const mappedValues = [...values.values()]
  const min = Math.min(...mappedValues)
  const max = Math.max(...mappedValues)
  const unit = history?.unit ?? '1000 t'

  function countryColor(value) {
    if (value == null) return missingColor
    const percentage = min === max ? 50 : 100 * (value - min) / (max - min)
    return `color-mix(in srgb, ${lowColor}, ${highColor} ${percentage}%)`
  }

  return (
    <div className="dashboard">
      <aside className="sidebar food-details" aria-label="World totals" tabIndex={0}>
        <h2>World</h2>
        <p>{item}{year && ` · ${year}`} · {unit}</p>
        {yearError ? <p>Year data unavailable.</p> : (
          <>
            <FoodMeasures result={world} elements={elements} />
            <CountryRankings result={map} unit={unit} />
            <section>
              <h3>Regional shares</h3>
              <RegionalPie result={regional} element={mapElement} unit={unit} />
            </section>
          </>
        )}
      </aside>

      <main className="map-panel">
        <div className="filters">
          {options?.data ? (
            <>
              <Filter label="Product" value={item} onChange={setItem} options={options.data.item} />
              {years.length > 0 ? (
                <label className="year-slider">
                  <span>Year <strong>{year}</strong></span>
                  <input
                    type="range"
                    min="0"
                    max={years.length - 1}
                    step="1"
                    value={years.indexOf(Number(year))}
                    aria-valuetext={year}
                    disabled={years.length === 1}
                    onChange={(event) => setYear(String(years[event.target.valueAsNumber]))}
                  />
                </label>
              ) : <p role="status">{yearError ? 'No years available.' : 'Loading years…'}</p>}
            </>
          ) : (
            <p role="status">{options?.error ? 'Could not load filters. Check that Flask is running.' : 'Loading filters…'}</p>
          )}
          <Filter
            label="Color map by"
            value={mapElement}
            onChange={setMapElement}
            options={elements}
          />
        </div>

        <div className="map-content">
          <svg className="world-map" viewBox="0 0 360 180" role="group" aria-label={`World map of ${mapElement}`}>
            {countryShapes.map(({ path, ...country }) => {
              const value = values.get(country.id)
              const label = `${country.name} · ${formatValue(value)}${value == null ? '' : ' ' + unit}`

              return (
                <path
                  key={country.id}
                  d={path}
                  fillRule="evenodd"
                  style={{ fill: countryColor(value) }}
                  className="country"
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  aria-pressed={selectedCountry?.id === country.id}
                  onClick={() => setSelectedCountry(country)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedCountry(country)
                    }
                  }}
                >
                  <title>{label}</title>
                </path>
              )
            })}
          </svg>
          {mappedValues.length > 0 ? (
            <div className="map-legend" aria-label={`Map scale in ${unit}`}>
              <span>{formatValue(min)}</span>
              <span className="legend-gradient" style={{ background: `linear-gradient(90deg, ${lowColor}, ${highColor})` }} />
              <span>{formatValue(max)} {unit}</span>
              <span className="legend-missing">No data</span>
            </div>
          ) : (
            <p role="status">
              {yearError ? 'Year data unavailable.' : map === null ? 'Loading map data…' : map.error ? 'Could not load map data. Check that Flask is running.' : 'No mapped countries have data for these filters.'}
            </p>
          )}
        </div>
      </main>

      <aside className="sidebar food-details" aria-label="Selected country" tabIndex={0}>
        {selectedCountry ? (
          <>
            <h2>{selectedCountry.name}</h2>
            <p>{item}{year && ` · ${year}`} · {unit}</p>
            {yearError ? <p>Year data unavailable.</p> : (
              <>
                <FoodMeasures result={map} elements={elements} countryId={selectedCountry.id} />
                <section>
                  <h3>Trade over time</h3>
                  <TradeTrend result={trend} years={years} unit={unit} />
                </section>
              </>
            )}
          </>
        ) : (
          <p>Select a country to see its food balance.</p>
        )}
      </aside>
    </div>
  )
}

export default App
