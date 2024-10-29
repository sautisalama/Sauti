"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Thermometer, Droplets, Wind, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

interface WeatherData {
	main: {
		temp: number;
		humidity: number;
		feels_like: number;
	};
	weather: Array<{
		main: string;
		description: string;
		icon: string;
	}>;
	name: string;
	wind: {
		speed: number;
	};
}

export default function Forecast() {
	const [weather, setWeather] = useState<WeatherData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	useEffect(() => {
		const fetchWeather = async (lat: number, lon: number) => {
			try {
				const response = await fetch(
					`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}`
				);

				if (!response.ok) {
					throw new Error("Failed to fetch weather data");
				}

				const data = await response.json();
				setWeather(data);
			} catch (err) {
				setError(err instanceof Error ? err.message : "An error occurred");
			} finally {
				setLoading(false);
			}
		};

		// Default coordinates for Nairobi
		const NAIROBI_COORDS = {
			latitude: -1.2921,
			longitude: 36.8219,
		};

		// Get user's location
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					fetchWeather(position.coords.latitude, position.coords.longitude);
				},
				(err) => {
					// Use Nairobi coordinates when location access is denied
					fetchWeather(NAIROBI_COORDS.latitude, NAIROBI_COORDS.longitude);
					setError(null); // Clear error since we're falling back to default location
					setLoading(false);
				}
			);
		} else {
			// Use Nairobi coordinates when geolocation is not supported
			fetchWeather(NAIROBI_COORDS.latitude, NAIROBI_COORDS.longitude);
			setError(null); // Clear error since we're falling back to default location
			setLoading(false);
		}
	}, []);

	if (loading) {
		return (
			<>
				{/* Mobile Banner Loading State */}
				<div className="fixed bottom-0 left-0 right-0 w-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-t md:hidden">
					<div className="p-2 flex items-center justify-between max-w-[50%] m-auto">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-24" />
					</div>
				</div>

				{/* Desktop Card Loading State */}
				<div className="hidden md:block fixed left-4 bottom-4 z-50">
					<Card className="w-[280px] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
						<CardContent className="p-4">
							<Skeleton className="h-4 w-24 mb-2" />
							<div className="flex items-center gap-2">
								<Skeleton className="h-10 w-10 rounded-full" />
								<div>
									<Skeleton className="h-6 w-16 mb-1" />
									<Skeleton className="h-4 w-20" />
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</>
		);
	}

	if (error || !weather) return null;

	const hasEmergencyAlert =
		weather.weather[0].main.toLowerCase().includes("extreme") ||
		weather.main.temp > 35 ||
		weather.main.temp < 0;

	return (
		<>
			{/* Emergency Alert */}
			{hasEmergencyAlert && (
				<Alert className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-red-200 animate-slide-down">
					<AlertTriangle className="h-4 w-4 text-red-600" />
					<AlertDescription className="text-red-700">
						Extreme weather conditions detected. Please take necessary precautions.
					</AlertDescription>
				</Alert>
			)}

			{/* Mobile Banner */}
			<div
				className="fixed bottom-0 left-0 right-0 w-full bg-sauti-blue text-white z-50 md:hidden cursor-pointer"
				onClick={() => router.push("/weather")}
			>
				<div className="flex items-center justify-between gap-4 p-2 md:max-w-[50%] m-auto">
					<span className="flex items-center gap-2">
						<img
							src={`https://openweathermap.org/img/w/${weather.weather[0].icon}.png`}
							alt={weather.weather[0].description}
							className="w-6 h-6"
						/>
						<p>{weather.name}</p>
					</span>
					<span className="flex items-center gap-4">
						<p className="font-bold">{Math.round(weather.main.temp)}°C</p>
						<p className="text-sm capitalize">{weather.weather[0].description}</p>
					</span>
				</div>
			</div>

			{/* Desktop Card */}
			<div
				className="hidden md:block fixed left-4 bottom-4 z-50 cursor-pointer"
				onClick={() => router.push("/weather")}
			>
				<Card className="w-[280px] bg-gradient-to-br from-blue-50/95 to-purple-50/95 dark:from-gray-800/95 dark:to-gray-900/95 backdrop-blur-sm hover:scale-105 transition-transform border-none shadow-lg">
					<CardContent className="p-4">
						<h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
							{weather.name} Weather
						</h3>
						<div className="flex items-center gap-4">
							<img
								src={`https://openweathermap.org/img/w/${weather.weather[0].icon}.png`}
								alt={weather.weather[0].description}
								className="w-10 h-10"
							/>
							<div>
								<p className="text-xl font-bold">{Math.round(weather.main.temp)}°C</p>
								<p className="text-sm text-gray-500 capitalize">
									{weather.weather[0].description}
								</p>
							</div>
						</div>
						<div className="grid grid-cols-3 gap-2 mt-3 text-xs">
							<div className="flex items-center gap-1">
								<Thermometer className="w-3 h-3" />
								{Math.round(weather.main.feels_like)}°C
							</div>
							<div className="flex items-center gap-1">
								<Droplets className="w-3 h-3" />
								{weather.main.humidity}%
							</div>
							<div className="flex items-center gap-1">
								<Wind className="w-3 h-3" />
								{weather.wind.speed} m/s
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</>
	);
}
