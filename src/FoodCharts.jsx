import { highColor, lowColor, regions, tradeElements } from './foodBalance.js'

const numberFormat = new Intl.NumberFormat()
const rankingElements = [...tradeElements, 'Domestic supply quantity']
const tradeColors = ['#a30d61', '#3156a1']
const regionColors = ['#f4b9d6', highColor, '#d765a0', '#bd3780', '#e990bc', lowColor]

function ChartStatus({ result }) {
  return <p role="status">{result?.error ? 'Could not load data.' : 'Loading…'}</p>
}

export function CountryRankings({ result, unit }) {
  if (!result?.data) return <ChartStatus result={result} />

  return rankingElements.map((element) => {
    const rows = result.data.rows.filter((row) => row.Element === element)
    return (
      <section key={element}>
        <h3>Top {element === 'Domestic supply quantity' ? 'domestic supply' : element === 'Import quantity' ? 'imports' : 'exports'}</h3>
        {rows.length ? (
          <ol className="ranking" tabIndex={0} aria-label={`${element} ranking in ${unit}`}>
            {rows.map((row) => (
              <li key={row.Area}>{row.Area} <strong>{numberFormat.format(row.Value)}</strong></li>
            ))}
          </ol>
        ) : <p>No data.</p>}
      </section>
    )
  })
}

export function RegionalPie({ result, element, unit }) {
  if (!result?.data) return <ChartStatus result={result} />

  const values = new Map(result.data.rows.map((row) => [row.Area, row.Value]))
  const asia = values.get('Asia')
  const china = values.get('China')
  const splitAsia = china > 0 && asia >= china
  const slices = regions.flatMap((region, index) => {
    if (region === 'China' && !splitAsia) return []
    const value = region === 'Asia' && splitAsia ? asia - china : values.get(region)
    const label = region === 'Asia' && splitAsia ? 'Asia excluding China' : region
    return value === undefined ? [] : [{ label, value, color: regionColors[index] }]
  })
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (total <= 0 || slices.some((slice) => slice.value < 0)) return <p>No breakdown available for this measure.</p>

  let end = 0
  const stops = []
  for (const { color, value } of slices.filter((slice) => slice.value > 0)) {
    const start = end
    end += (value / total) * 100
    stops.push(`${color} ${start}% ${end}%`)
  }

  return (
    <>
      <p>{element} · {unit}</p>
      <div className="regional-pie" aria-hidden="true" style={{ background: `conic-gradient(${stops.join(', ')})` }} />
      <ul className="chart-legend">
        {slices.map(({ label, color, value }) => (
          <li key={label}><span style={{ background: color }} />{label} · {numberFormat.format(value)} ({(value / total * 100).toFixed(1)}%)</li>
        ))}
      </ul>
    </>
  )
}

export function TradeTrend({ result, years, unit }) {
  if (!result?.data) return <ChartStatus result={result} />
  const rows = result.data.rows
  if (!rows.length || !years.length) return <p>No trade history for this product.</p>

  const min = Math.min(0, ...rows.map((row) => row.Value))
  const max = Math.max(...rows.map((row) => row.Value), min + 1)
  const firstYear = Number(years[0])
  const lastYear = Number(years.at(-1))
  const timeline = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)
  const x = (year) => firstYear === lastYear ? 130 : 56 + 190 * (year - firstYear) / (lastYear - firstYear)
  const y = (value) => 102 - 86 * (value - min) / (max - min)
  const ticks = firstYear === lastYear ? [firstYear] : [firstYear, lastYear]

  return (
    <>
      <p>{unit}</p>
      <svg className="trade-chart" viewBox="0 0 260 130" role="img" aria-label={`Import and export quantities in ${unit}, ${firstYear} to ${lastYear}`}>
        <path d="M56 16V102H246" fill="none" stroke="#b6bec6" />
        {[min, max].map((value) => (
          <text key={value} x="51" y={y(value) + 3} textAnchor="end">{numberFormat.format(value)}</text>
        ))}
        {ticks.map((year) => <text key={year} x={x(year)} y="120" textAnchor="middle">{year}</text>)}
        {tradeElements.map((element, index) => {
          const values = new Map(rows.filter((row) => row.Element === element).map((row) => [row.Year, row.Value]))
          const points = timeline.flatMap((year) => values.has(year) ? [{ year, value: values.get(year) }] : [])
          const line = points.map(({ year, value }) => `${values.has(year - 1) ? 'L' : 'M'}${x(year)},${y(value)}`).join(' ')
          return (
            <g key={element} fill={tradeColors[index]}>
              <path d={line} fill="none" stroke={tradeColors[index]} strokeWidth="2" />
              {points.map(({ year, value }) => (
                <circle key={year} cx={x(year)} cy={y(value)} r="2.8">
                  <title>{year} · {element} · {numberFormat.format(value)} {unit}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
      <ul className="chart-legend">
        {tradeElements.map((element, index) => (
          <li key={element}><span style={{ background: tradeColors[index] }} />{element}</li>
        ))}
      </ul>
    </>
  )
}
