import { detectPaneState } from './src/pane-state.ts'
import { readFileSync } from 'fs'

const pane = readFileSync('/tmp/pane-cap.txt', 'utf8')
console.log(detectPaneState(pane))
