import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { installRadio } from './ui/radio'
import { installClickSound } from './ui/sfx'
import { loadSpriteManifest } from './ui/spriteSheets'

installClickSound()
installRadio()

loadSpriteManifest().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
