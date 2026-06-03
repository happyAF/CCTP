import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import EntryPage from './pages/EntryPage'
import RoomPage from './pages/RoomPage'
import './styles/globals.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EntryPage />} />
        <Route path="/room/:roomCode" element={<RoomPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
