"use client";

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw, BarChart2 } from 'lucide-react';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, ReferenceLine, Cell, useXAxisScale, useYAxisScale,
} from 'recharts';

interface ChartDataPoint {
  time: number; open: number; high: number; low: number; close: number;
  dateStr: string; ohlc: [number, number];
  rsi?: number; macd?: number; macdSignal?: number; macdHistogram?: number;
  stochK?: number; stochD?: number; ma10?: number; ma20?: number;
  volume?: number; volumeMa?: number;
  bbUpper?: number | null; bbMiddle?: number | null; bbLower?: number | null;
}

const CandleBody = ({ x, y, width, height, payload }: { x?: number; y?: number; width?: number; height?: number; payload?: ChartDataPoint }) => {
  if (x===undefined||y===undefined||width===undefined||height===undefined||!payload) return null;
  const color = payload.close >= payload.open ? '#10b981' : '#f43f5e';
  const gap = Math.max(Math.floor(width*0.15),1);
  return <rect x={x+gap} y={y} width={Math.max(width-gap*2,1)} height={Math.max(height,1.5)} fill={color}/>;
};

const VolumeLayer = ({ data }: { data: ChartDataPoint[] }) => {
  const xScale = useXAxisScale() as ((v: string) => number) & { bandwidth?: () => number } | undefined;
  const yScale = useYAxisScale('volume') as ((v: number) => number) | undefined;
  if (!xScale||!yScale) return null;
  const bw = xScale.bandwidth ? xScale.bandwidth() : 8;
  const baseY = yScale(0);
  return <g>{data.map((d,i) => {
    if (!d.volume) return null;
    const barY = yScale(d.volume);
    return <rect key={i} x={xScale(d.dateStr)+1} y={barY} width={Math.max(bw-2,1)} height={Math.max(baseY-barY,1)} fill={(d.close??0)>=(d.open??0)?'#10b981':'#f43f5e'} fillOpacity={0.4}/>;
  })}</g>;
};

const WickLayer = ({ data, yAxisId }: { data: ChartDataPoint[]; yAxisId?: string }) => {
  const xScale = useXAxisScale() as ((v: string) => number) & { bandwidth?: () => number } | undefined;
  const yScale = useYAxisScale(yAxisId) as ((v: number) => number) | undefined;
  if (!xScale||!yScale) return null;
  const bw = xScale.bandwidth ? xScale.bandwidth() : 8;
  return <g>{data.map((d,i) => {
    const cx = xScale(d.dateStr)+bw/2;
    return <line key={i} x1={cx} y1={yScale(d.high)} x2={cx} y2={yScale(d.low)} stroke={d.close>=d.open?'#10b981':'#f43f5e'} strokeWidth={1}/>;
  })}</g>;
};

export default function ChartView({ ticker }: { ticker: string }) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMA10, setShowMA10] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showBB, setShowBB] = useState(true);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/stocks/${ticker}`)
      .then(r => { if (!r.ok) throw new Error('Failed to fetch chart data'); return r.json(); })
      .then((json: (ChartDataPoint & { open: number; high: number; low: number; close: number; time: number })[]) => {
        setChartData(json.map((d,i,arr) => {
          const ma = (p: number) => { if (i<p-1) return undefined; return arr.slice(i-p+1,i+1).reduce((s,x)=>s+x.close,0)/p; };
          const volMa = (() => { if (i<19) return undefined; return arr.slice(i-19,i+1).reduce((s,x)=>s+(x.volume??0),0)/20; })();
          return { ...d, dateStr: format(new Date(d.time*1000),'MMM dd'), ohlc: [Math.min(d.open,d.close),Math.max(d.open,d.close)] as [number,number], ma10: ma(10), ma20: ma(20), volumeMa: volMa };
        }));
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div className="p-8 text-center text-slate-400 flex justify-center items-center gap-2"><RefreshCw size={16} className="animate-spin"/> Loading chart...</div>;
  if (error)   return <div className="p-8 text-center text-rose-400">Error: {error}</div>;
  if (!chartData.length) return <div className="p-8 text-center text-slate-400">No chart data available.</div>;

  const minPrice = Math.min(...chartData.map(d=>d.low));
  const maxPrice = Math.max(...chartData.map(d=>d.high));
  const maxVolume = Math.max(...chartData.map(d=>d.volume??0));

  return (
    <div className="p-6 bg-slate-900 border-t border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2"><BarChart2 className="text-blue-400"/> {ticker} - 6 Months</h3>
        <div className="flex items-center gap-2">
          {([{label:'MA10',color:'#f59e0b',active:showMA10,toggle:()=>setShowMA10(v=>!v)},{label:'MA20',color:'#60a5fa',active:showMA20,toggle:()=>setShowMA20(v=>!v)},{label:'BB',color:'#f43f5e',active:showBB,toggle:()=>setShowBB(v=>!v)}] as const).map(({label,color,active,toggle})=>(
            <button key={label} onClick={toggle} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${active?'border-transparent':'border-slate-600 opacity-40'}`} style={active?{backgroundColor:color+'22',color,borderColor:color+'55'}:{}}>
              <span className="inline-block w-3 h-0.5 rounded" style={{backgroundColor:active?color:'#475569'}}/>{label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{top:10,right:60,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false}/>
            <XAxis dataKey="dateStr" stroke="#94a3b8" fontSize={11} tickMargin={8} minTickGap={40}/>
            <YAxis yAxisId="price" domain={[minPrice*0.985,maxPrice*1.015]} stroke="#94a3b8" fontSize={11} tickFormatter={v=>v.toLocaleString()} orientation="right" width={70}/>
            <YAxis yAxisId="volume" domain={[0,maxVolume*4]} hide/>
            <Tooltip contentStyle={{backgroundColor:'#1e293b',borderColor:'#334155',color:'#f1f5f9'}} itemStyle={{color:'#60a5fa'}} labelStyle={{color:'#94a3b8',marginBottom:'4px',fontWeight:'bold'}}
              formatter={(value,name,props:{payload?:ChartDataPoint})=>{
                if (name==='OHLC'&&props.payload){const{open,high,low,close}=props.payload;return[`O:${open.toLocaleString()} H:${high.toLocaleString()} L:${low.toLocaleString()} C:${close.toLocaleString()}`,'Price'];}
                if (name==='Volume'){const v=Number(value);return[v>=1e6?`${(v/1e6).toFixed(2)}M`:v>=1e3?`${(v/1e3).toFixed(0)}K`:String(v),'Volume'];}
                return[value as string,String(name)];
              }}/>
            <VolumeLayer data={chartData}/>
            <Line yAxisId="volume" type="monotone" dataKey="volumeMa" stroke="#f59e0b99" strokeWidth={1.5} dot={false} name="Vol MA20" connectNulls/>
            <WickLayer data={chartData} yAxisId="price"/>
            <Bar yAxisId="price" dataKey="ohlc" name="OHLC" shape={<CandleBody/>} isAnimationActive={false}/>
            {showMA10&&<Line yAxisId="price" type="monotone" dataKey="ma10" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MA10" connectNulls/>}
            {showMA20&&<Line yAxisId="price" type="monotone" dataKey="ma20" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="MA20" connectNulls/>}
            {showBB&&<Line yAxisId="price" type="monotone" dataKey="bbUpper" stroke="#f43f5e" strokeWidth={1} strokeDasharray="4 3" dot={false} name="BB Upper" connectNulls/>}
            {showBB&&<Line yAxisId="price" type="monotone" dataKey="bbMiddle" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" dot={false} name="BB Mid" connectNulls/>}
            {showBB&&<Line yAxisId="price" type="monotone" dataKey="bbLower" stroke="#10b981" strokeWidth={1} strokeDasharray="4 3" dot={false} name="BB Lower" connectNulls/>}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {[{title:'RSI (14)',key:'rsi',color:'#a78bfa',ticks:[30,70],refs:[{y:70,s:'#f43f5e'},{y:30,s:'#10b981'}],domain:[0,100] as [number,number]},
        {title:'MACD (12,26,9)',key:'macd',color:'#3b82f6',ticks:undefined,refs:[],domain:undefined},
        {title:'Stochastic RSI',key:'stochK',color:'#3b82f6',ticks:[20,80],refs:[{y:80,s:'#f43f5e'},{y:20,s:'#10b981'}],domain:[0,100] as [number,number]}
      ].map(({title,key,color,ticks,refs,domain})=>(
        <div key={key} className="h-[120px] w-full mt-4">
          <h4 className="text-sm font-semibold mb-2 text-slate-400">{title}</h4>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{top:10,right:60,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false}/>
              <XAxis dataKey="dateStr" stroke="#94a3b8" fontSize={11} hide/>
              <YAxis domain={domain} stroke="#94a3b8" fontSize={11} ticks={ticks} width={70} orientation="right"/>
              <Tooltip contentStyle={{backgroundColor:'#1e293b',borderColor:'#334155',color:'#f1f5f9'}}/>
              {refs.map(r=><ReferenceLine key={r.y} y={r.y} stroke={r.s} strokeDasharray="5 5"/>)}
              {key==='macd' ? (
                <>
                  <Bar dataKey="macdHistogram" name="Histogram">{chartData.map((e,i)=><Cell key={i} fill={(e.macdHistogram??0)>0?'#10b981':'#f43f5e'}/>)}</Bar>
                  <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MACD"/>
                  <Line type="monotone" dataKey="macdSignal" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Signal"/>
                </>
              ) : key==='stochK' ? (
                <>
                  <Line type="monotone" dataKey="stochK" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="%K" connectNulls/>
                  <Line type="monotone" dataKey="stochD" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="%D" connectNulls/>
                </>
              ) : <Line type="monotone" dataKey={key} stroke={color} strokeWidth={1.5} dot={false} name={key.toUpperCase()} connectNulls/>}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
