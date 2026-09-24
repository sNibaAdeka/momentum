import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/sections.css'
import App from './App'

document.documentElement.classList.add('js')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
