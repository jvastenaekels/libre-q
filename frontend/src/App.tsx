import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StudyLayout from './layouts/StudyLayout';
import WelcomePage from './pages/WelcomePage';
import PreSortPage from './pages/PreSortPage';
import RoughSortPage from './pages/RoughSortPage';
import FineSortPage from './pages/FineSortPage';
import PostSortPage from './pages/PostSortPage';
import ErrorPage from './pages/ErrorPage';
import LandingPage from './pages/LandingPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        <Route path="/study/:slug" element={<StudyLayout />}>
          <Route path="welcome" element={<WelcomePage />} />
          <Route path="presort" element={<PreSortPage />} />
          <Route path="rough-sort" element={<RoughSortPage />} />
          <Route path="sort" element={<FineSortPage />} /> 
          <Route path="post-sort" element={<PostSortPage />} />

          <Route path="*" element={<ErrorPage />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
