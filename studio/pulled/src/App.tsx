import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Desk from '@/pages/Desk'
import Receipt from '@/pages/Receipt'
import Proof from '@/pages/Proof'
import Docs from '@/pages/Docs'
import NotFound from '@/pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="desk" element={<Desk />} />
          <Route path="r/:requestId" element={<Receipt />} />
          <Route path="proof" element={<Proof />} />
          <Route path="docs" element={<Docs />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
