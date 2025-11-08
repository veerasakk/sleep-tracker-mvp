import SleepTracker from './components/SleepTracker';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-indigo-700 mb-2">หลับดี</h1>
      <p className="text-gray-600 mb-6">วิเคราะห์การนอนด้วยมือถือเครื่องเดียว</p>
      <SleepTracker />
    </div>
  );
}

export default App;