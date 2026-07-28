import { Route, Routes } from 'react-router-dom'
import { DeckDetailPage } from '../features/decks/DeckDetail'
import { DeckListPage } from '../features/decks/DeckList'

export const DecksPage = () => (
  <Routes>
    <Route index element={<DeckListPage />} />
    <Route path=":deckId" element={<DeckDetailPage />} />
  </Routes>
)
