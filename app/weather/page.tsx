import Forecast from "@/components/forecast";
import { Nav } from "@/components/Nav";
import Weather from "@/components/weather";

export default function WeatherPage() {
	return (
		<>
			<Nav />
			{/* <Weather /> */}
			{/* <Forecast /> */}
			<div className="container py-20 text-center">
				<h1 className="text-3xl font-bold mb-4">Weather Safety Alerts</h1>
				<p className="text-gray-600">This feature is currently deactivated.</p>
			</div>
		</>
	);
}
