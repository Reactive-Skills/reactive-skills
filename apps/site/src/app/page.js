import { getDocsContentSource } from '@/infrastructure/container';
import { LandingPage } from '@/features/landing/LandingPage';

function App() {
  const content = getDocsContentSource();
  const machine = content.getStateMachine();
  const flow = content.getEventFlow();
  return <LandingPage machine={machine} flow={flow} />;
}

export default App;
