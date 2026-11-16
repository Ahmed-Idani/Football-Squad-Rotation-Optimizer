import { useState , useEffect } from 'react'
import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { apiFetch } from "./lib/api.js";
import { MatchSetup } from "./pages/MatchSetup/MatchSetup";
import {ChooseTeam} from "./pages/ChooseTeam/ChooseTeam.jsx";
import {TeamPage} from "./pages/TeamPage/TeamPage.jsx";
import { Results } from "./pages/Results/Results.jsx";
import { BoomBox } from "./components/boombox/BoomBox.jsx";
import { BackendStatus } from "./components/backendStatus/BackendStatus.jsx";
import { GitHubLink } from "./components/githubLink/GitHubLink.jsx";
function App() {
    // null until the first answer, so the home page can tell "still loading"
    // apart from "no teams". Also the request that wakes a sleeping API.
    const [teams,setTeams]=useState(null)
    const [teamsError,setTeamsError]=useState(false)
    useEffect(()=>{
        fetchTeams()
    },[])
    const fetchTeams = async ()=>{
        try {
            const response = await apiFetch("api/teams/")
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = await response.json()
            setTeams(data.teams ?? [])
        } catch {
            setTeams([])
            setTeamsError(true)
        }
    }
    return (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ChooseTeam teams={teams} error={teamsError}/>} />
            <Route path="/teams/:team_name" element={<TeamPage/>}></Route>
            <Route path="/setup/:team_name" element={<MatchSetup />} />
            <Route path="/results/:team_name" element={<Results />} />
          </Routes>
          <BackendStatus />
          {/* Bottom left: bottom right is taken by Netlify's free-tier badge. */}
          <div className="corner-dock">
            <BoomBox />
            <GitHubLink />
          </div>
        </BrowserRouter>
    )
}

export default App
