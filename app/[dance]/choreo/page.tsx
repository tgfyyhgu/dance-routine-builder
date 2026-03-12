"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

interface Figure {
  id:string
  name:string
  difficulty:number
  note:string
  youtube_url:string
  start_time:number
  end_time:number
}

export default function ChoreoPage(){

const params = useParams()
const dance = params.dance as string

const [figures,setFigures]=useState<Figure[]>([])
const [expanded,setExpanded]=useState<string | null>(null)

const [panelWidth,setPanelWidth]=useState(300)
const [collapsed,setCollapsed]=useState(false)

useEffect(()=>{

async function load(){

const {data}=await supabase
.from("figures")
.select("*")
.eq("dance_style",dance)
.order("name",{ascending:true})

if(data){
setFigures(data)
}

}

load()

},[])

function toggleExpand(id:string){

if(expanded===id){
setExpanded(null)
}else{
setExpanded(id)
}

}

function startResize(e:React.MouseEvent){

const startX=e.clientX
const startWidth=panelWidth

function onMove(e:MouseEvent){

const newWidth=startWidth+(e.clientX-startX)

if(newWidth<120){
setCollapsed(true)
}else{
setCollapsed(false)
setPanelWidth(Math.min(newWidth,500))
}

}

function stop(){

window.removeEventListener("mousemove",onMove)
window.removeEventListener("mouseup",stop)

}

window.addEventListener("mousemove",onMove)
window.addEventListener("mouseup",stop)

}

return(

<div className="flex h-screen">

{/* PANEL */}

{!collapsed && (

<div
className="border-r bg-gray-50 overflow-y-auto"
style={{width:panelWidth}}
>

<div className="p-3 border-b flex justify-between">

<span className="font-bold">
Figures
</span>

<button
onClick={()=>setCollapsed(true)}
className="text-gray-600"
>
◀
</button>

</div>

{figures.map((fig)=>{

let videoId:string|null=null

if(fig.youtube_url){

const regExp=/^.*(?:youtu\.be\/|watch\?v=)([^#&?]*).*/
const match=regExp.exec(fig.youtube_url)

videoId=match && match[1].length===11 ? match[1] : null

}

return(

<div
key={fig.id}
className="border-b"
>

<button
className="w-full text-left p-2 hover:bg-gray-100"
onClick={()=>toggleExpand(fig.id)}
>

{fig.name}

</button>

{expanded===fig.id && (

<div className="p-3 text-sm space-y-2">

<div>
Difficulty: {fig.difficulty}
</div>

<div>
{fig.note}
</div>

{videoId && (

<iframe
width="260"
height="150"
src={`https://www.youtube.com/embed/${videoId}?start=${fig.start_time || 0}&end=${fig.end_time || ""}`}
allowFullScreen
/>

)}

</div>

)}

</div>

)

})}

</div>

)}

{/* RESIZE BAR */}

{!collapsed && (

<div
className="w-1 bg-gray-300 cursor-col-resize"
onMouseDown={startResize}
/>

)}

{/* OPEN PANEL BUTTON */}

{collapsed && (

<button
className="p-2 border-r"
onClick={()=>setCollapsed(false)}
>
▶
</button>

)}

{/* CHOREO AREA */}

<div className="flex-1 p-10">

<h1 className="text-2xl font-bold mb-4">

{dance.toUpperCase()} Choreography Builder

</h1>

<p className="text-gray-500">

Routine builder will go here.

</p>

</div>

</div>

)

}