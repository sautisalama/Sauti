"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Cloud,
	Droplets,
	Wind,
	Search,
	MapPin,
	Thermometer,
	Sun,
	CloudRain,
	AlertTriangle,
} from "lucide-react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

// Types
type Coordinates = {
	lat: number;
	lon: number;
};

type Location = {
	name: string;
	country: string;
} & Coordinates;

type WeatherData = {
	current: {
		temp: number;
		feels_like: number;
		humidity: number;
		wind_speed: number;
		weather: [
			{
				main: string;
				description: string;
				icon: string;
			}
		];
	};
	daily: Array<{
		dt: number;
		temp: {
			day: number;
			min: number;
			max: number;
		};
		weather: [
			{
				main: string;
				description: string;
				icon: string;
			}
		];
		humidity: number;
		wind_speed: number;
		pop: number; // Probability of precipitation
	}>;
	hourly: Array<{
		dt: number;
		temp: number;
		weather: [
			{
				main: string;
				description: string;
				icon: string;
			}
		];
		pop: number;
	}>;
};

const WeatherDashboard = () => {
	const [location, setLocation] = useState<Location>({
		name: "Nairobi",
		country: "KE",
		lat: -1.2921,
		lon: 36.8219,
	});
	const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Get user's location
	useEffect(() => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				async (position) => {
					try {
						const { latitude, longitude } = position.coords;
						const locationData = await fetchLocationName(latitude, longitude);
						setLocation(locationData);
					} catch (err) {
						console.error("Failed to fetch location name:", err);
						setError("Failed to get location name");
					}
				},
				(error) => {
					console.error("Geolocation error:", error);
				}
			);
		}
	}, []);

	const fetchLocationName = async (lat: number, lon: number) => {
		const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
		const response = await fetch(
			`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`
		);
		const data = await response.json();

		if (!data?.[0]?.name || !data?.[0]?.country) {
			throw new Error("Invalid location data received");
		}

		return {
			name: data[0].name,
			country: data[0].country,
			lat,
			lon,
		};
	};

	const fetchWeatherData = useCallback(async () => {
		try {
			setIsLoading(true);
			const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

			// Current weather
			const currentResponse = await fetch(
				`https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&units=metric&appid=${API_KEY}`
			);

			// 5 day forecast (includes 3-hourly forecasts)
			const forecastResponse = await fetch(
				`https://api.openweathermap.org/data/2.5/forecast?lat=${location.lat}&lon=${location.lon}&units=metric&appid=${API_KEY}`
			);

			if (!currentResponse.ok || !forecastResponse.ok) {
				throw new Error("Failed to fetch weather data");
			}

			const currentData = await currentResponse.json();
			const forecastData = await forecastResponse.json();

			// Transform the data to match your WeatherData type
			const transformedData: WeatherData = {
				current: {
					temp: currentData.main.temp,
					feels_like: currentData.main.feels_like,
					humidity: currentData.main.humidity,
					wind_speed: currentData.wind.speed,
					weather: currentData.weather,
				},
				hourly: forecastData.list.slice(0, 24).map((item: any) => ({
					dt: item.dt,
					temp: item.main.temp,
					weather: item.weather,
					pop: item.pop || 0,
				})),
				daily: forecastData.list
					.filter((item: any, index: number) => index % 8 === 0) // Get one reading per day
					.map((item: any) => ({
						dt: item.dt,
						temp: {
							day: item.main.temp,
							min: item.main.temp_min,
							max: item.main.temp_max,
						},
						weather: item.weather,
						humidity: item.main.humidity,
						wind_speed: item.wind.speed,
						pop: item.pop || 0,
					})),
			};

			setWeatherData(transformedData);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setIsLoading(false);
		}
	}, [location]);

	// Fetch weather data when location or API key changes
	useEffect(() => {
		fetchWeatherData();
	}, [fetchWeatherData]);

	const handleSearch = async () => {
		try {
			if (!searchQuery.trim()) {
				setError("Please enter a location");
				return;
			}

			const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
			const response = await fetch(
				`https://api.openweathermap.org/geo/1.0/direct?q=${searchQuery}&limit=1&appid=${API_KEY}`
			);
			const data = await response.json();

			if (data.length === 0) {
				setError("Location not found");
				return;
			}

			setLocation({
				name: data[0].name,
				country: data[0].country,
				lat: data[0].lat,
				lon: data[0].lon,
			});
			setError(null); // Clear any previous errors
		} catch (err) {
			setError("Failed to search location");
		}
	};

	const hasAdverseWeather = (data: WeatherData) => {
		// Severe weather conditions to check for
		const severeConditions = [
			"Thunderstorm",
			"Heavy rain",
			"Snow",
			"Extreme",
			"Hurricane",
			"Tornado",
			"Storm",
		];

		// Temperature thresholds (in Celsius)
		const EXTREME_HEAT = 35;
		const EXTREME_COLD = 0;

		// Check next 24 hours (hourly data)
		const hasExtremeHourly = data.hourly.some((hour) => {
			const hasExtremeTemp =
				hour.temp >= EXTREME_HEAT || hour.temp <= EXTREME_COLD;
			const hasSevereWeather = severeConditions.some(
				(condition) =>
					hour.weather[0].main.includes(condition) ||
					hour.weather[0].description.toLowerCase().includes("heavy")
			);
			return hasExtremeTemp || hasSevereWeather;
		});

		// Check next week (daily data)
		const hasExtremeDaily = data.daily.some((day) => {
			const hasExtremeTemp =
				day.temp.max >= EXTREME_HEAT || day.temp.min <= EXTREME_COLD;
			const hasSevereWeather = severeConditions.some(
				(condition) =>
					day.weather[0].main.includes(condition) ||
					day.weather[0].description.toLowerCase().includes("heavy")
			);
			return hasExtremeTemp || hasSevereWeather;
		});

		return hasExtremeHourly || hasExtremeDaily;
	};

	const formatHourlyChartData = (data: WeatherData["hourly"]) => {
		return data.map((hour) => ({
			time: new Date(hour.dt * 1000).toLocaleTimeString("en-US", {
				hour: "numeric",
				hour12: true,
			}),
			temperature: Math.round(hour.temp),
			precipitation: Math.round(hour.pop * 100),
		}));
	};

	const formatDailyChartData = (data: WeatherData["daily"]) => {
		return data.map((day) => ({
			date: new Date(day.dt * 1000).toLocaleDateString("en-US", {
				weekday: "short",
			}),
			high: Math.round(day.temp.max),
			low: Math.round(day.temp.min),
			precipitation: Math.round(day.pop * 100),
		}));
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-blue-400 to-blue-300 dark:from-blue-900 dark:to-blue-800 p-4">
				<div className="max-w-7xl mx-auto space-y-6">
					{/* Search Bar Skeleton */}
					<div className="flex flex-col sm:flex-row gap-3">
						<Skeleton className="h-10 flex-1" />
						<div className="flex gap-2">
							<Skeleton className="h-10 w-24" />
							<Skeleton className="h-10 w-32" />
						</div>
					</div>

					{/* Location Skeleton */}
					<div className="flex items-center gap-2">
						<Skeleton className="h-6 w-6 rounded-full" />
						<Skeleton className="h-8 w-48" />
					</div>

					{/* Current Weather Card Skeleton */}
					<div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-white/20 shadow-lg rounded-lg p-4">
						<div className="flex flex-col md:flex-row items-center justify-between gap-4">
							<div className="flex items-center gap-2">
								<Skeleton className="w-24 h-24 rounded-lg" />
								<div className="text-center md:text-left">
									<Skeleton className="h-12 w-32 mb-2" />
									<Skeleton className="h-6 w-24" />
								</div>
							</div>
							<div className="grid grid-cols-3 gap-4 w-full md:w-auto">
								<WeatherDetailSkeleton />
								<WeatherDetailSkeleton />
								<WeatherDetailSkeleton />
							</div>
						</div>
					</div>

					{/* Charts Skeleton */}
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
						<div className="lg:col-span-2 bg-white/90 dark:bg-gray-800/90 rounded-lg p-4">
							<Skeleton className="h-8 w-48 mb-4" />
							<Skeleton className="h-[200px] w-full" />
						</div>
						<div className="bg-white/90 dark:bg-gray-800/90 rounded-lg p-4">
							<Skeleton className="h-8 w-32 mb-4" />
							<Skeleton className="h-[200px] w-full mb-6" />
							<div className="space-y-4">
								{[...Array(6)].map((_, i) => (
									<div key={i} className="flex items-center justify-between">
										<Skeleton className="h-6 w-16" />
										<Skeleton className="h-8 w-8 rounded-full" />
										<Skeleton className="h-6 w-16" />
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertTriangle className="h-4 w-4" />
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		);
	}

	if (!weatherData) return null;

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-400 to-blue-300 dark:from-blue-900 dark:to-blue-800 p-4">
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Search Bar - Improved mobile layout */}
				<div className="flex flex-col sm:flex-row gap-3">
					<div className="flex-1">
						<Input
							placeholder="Search location..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyPress={(e) => e.key === "Enter" && handleSearch()}
							className="bg-white/90 dark:bg-gray-800/90 border-0 backdrop-blur-sm"
						/>
					</div>
					<div className="flex gap-2">
						<Button
							onClick={handleSearch}
							className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
						>
							<Search className="w-4 h-4 mr-2" />
							Search
						</Button>
						<Button
							variant="outline"
							onClick={() =>
								navigator.geolocation.getCurrentPosition(async (position) => {
									const locationData = await fetchLocationName(
										position.coords.latitude,
										position.coords.longitude
									);
									setLocation(locationData);
								})
							}
							className="flex-1 sm:flex-none bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
						>
							<MapPin className="w-4 h-4 mr-2" />
							<span className="sm:inline hidden">Use My Location</span>
							<span className="sm:hidden inline">Location</span>
						</Button>
					</div>
				</div>

				{/* Current Location - Enhanced styling */}
				<div className="flex items-center gap-2 text-white">
					<MapPin className="w-6 h-6" />
					<h1 className="text-2xl font-bold">
						{location.name}, {location.country}
					</h1>
				</div>

				{/* Current Weather Card - Reduced size */}
				<Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-white/20 shadow-lg">
					<CardContent className="p-4">
						<div className="flex flex-col md:flex-row items-center justify-between gap-4">
							<div className="flex items-center gap-2">
								<img
									src={`https://openweathermap.org/img/w/${weatherData.current.weather[0].icon}.png`}
									alt={weatherData.current.weather[0].description}
									className="w-24 h-24"
								/>
								<div className="text-center md:text-left">
									<div className="text-5xl font-bold text-blue-600 dark:text-blue-400">
										{Math.round(weatherData.current.temp)}°C
									</div>
									<div className="text-lg text-gray-600 dark:text-gray-300 capitalize mt-1">
										{weatherData.current.weather[0].description}
									</div>
								</div>
							</div>

							{/* Weather details grid - Reduced size */}
							<div className="grid grid-cols-3 gap-4 w-full md:w-auto">
								<WeatherDetail
									icon={<Thermometer className="w-5 h-5 text-red-500" />}
									label="Feels like"
									value={`${Math.round(weatherData.current.feels_like)}°C`}
								/>
								<WeatherDetail
									icon={<Droplets className="w-5 h-5 text-blue-500" />}
									label="Humidity"
									value={`${weatherData.current.humidity}%`}
								/>
								<WeatherDetail
									icon={<Wind className="w-5 h-5 text-gray-500" />}
									label="Wind"
									value={`${Math.round(weatherData.current.wind_speed)} m/s`}
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Adverse Weather Alert */}
				{hasAdverseWeather(weatherData) && (
					<Alert className="bg-yellow-50 border-yellow-200">
						<AlertTriangle className="h-4 w-4 text-yellow-600" />
						<AlertTitle className="text-yellow-800">Weather Warning</AlertTitle>
						<AlertDescription className="text-yellow-700">
							Severe weather conditions or extreme temperatures expected in the coming
							days. Please monitor local weather updates and take necessary
							precautions.
						</AlertDescription>
					</Alert>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Hourly Forecast Widget */}
					<Card>
						<CardHeader>
							<CardTitle>Next 24 Hours</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="h-[200px] mb-6">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart
										data={formatHourlyChartData(weatherData.hourly.slice(0, 24))}
									>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="time" tick={{ fontSize: 12 }} interval={3} />
										<YAxis
											yAxisId="temp"
											tick={{ fontSize: 12 }}
											domain={["auto", "auto"]}
											label={{
												value: "°C",
												position: "insideLeft",
												angle: -90,
												dy: 40,
											}}
										/>
										<YAxis
											yAxisId="precip"
											orientation="right"
											domain={[0, 100]}
											tick={{ fontSize: 12 }}
											label={{
												value: "Precipitation %",
												position: "insideRight",
												angle: 90,
												dx: 10,
											}}
										/>
										<Tooltip />
										<Line
											yAxisId="temp"
											type="monotone"
											dataKey="temperature"
											stroke="#2563eb"
											strokeWidth={2}
											dot={false}
										/>
										<Line
											yAxisId="precip"
											type="monotone"
											dataKey="precipitation"
											stroke="#60a5fa"
											strokeWidth={2}
											dot={false}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
							<div className="space-y-4">
								{weatherData.hourly.slice(1, 7).map((hour) => (
									<div key={hour.dt} className="flex items-center justify-between">
										<div className="w-16">
											{new Date(hour.dt * 1000).toLocaleTimeString("en-US", {
												hour: "numeric",
												hour12: true,
											})}
										</div>
										<img
											src={`https://openweathermap.org/img/w/${hour.weather[0].icon}.png`}
											alt={hour.weather[0].description}
											className="w-8 h-8"
										/>
										<div className="w-16 text-right">{Math.round(hour.temp)}°C</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Extended Forecast - Now takes 2 columns */}
					<Card className="lg:col-span-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-white/20">
						<CardContent className="p-4">
							<Tabs defaultValue="3days">
								<TabsList className="bg-white/50 dark:bg-gray-700/50">
									<TabsTrigger value="3days">3-Day Forecast</TabsTrigger>
									<TabsTrigger value="week">Week Ahead</TabsTrigger>
								</TabsList>

								<TabsContent value="3days">
									<div className="bg-white/50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
										<div className="h-[200px]">
											<ResponsiveContainer width="100%" height="100%">
												<LineChart
													data={formatDailyChartData(weatherData.daily.slice(0, 4))}
												>
													<CartesianGrid strokeDasharray="3 3" />
													<XAxis dataKey="date" tick={{ fontSize: 12 }} />
													<YAxis
														yAxisId="temp"
														tick={{ fontSize: 12 }}
														domain={["auto", "auto"]}
														label={{
															value: "°C",
															position: "insideLeft",
															angle: -90,
															dy: 40,
														}}
													/>
													<YAxis
														yAxisId="precip"
														orientation="right"
														domain={[0, 100]}
														tick={{ fontSize: 12 }}
														label={{
															value: "Precipitation %",
															position: "insideRight",
															angle: 90,
															dx: 10,
														}}
													/>
													<Tooltip />
													<Line
														yAxisId="temp"
														type="monotone"
														dataKey="high"
														stroke="#dc2626"
														strokeWidth={2}
														name="High"
													/>
													<Line
														yAxisId="temp"
														type="monotone"
														dataKey="low"
														stroke="#2563eb"
														strokeWidth={2}
														name="Low"
													/>
													<Line
														yAxisId="precip"
														type="monotone"
														dataKey="precipitation"
														stroke="#60a5fa"
														strokeWidth={2}
														name="Precipitation"
													/>
												</LineChart>
											</ResponsiveContainer>
										</div>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										{weatherData.daily.slice(1, 4).map((day) => (
											<Card key={day.dt}>
												<CardHeader>
													<CardTitle>
														{new Date(day.dt * 1000).toLocaleDateString("en-US", {
															weekday: "long",
															month: "short",
															day: "numeric",
														})}
													</CardTitle>
												</CardHeader>
												<CardContent>
													<div className="flex flex-col items-center space-y-2">
														<img
															src={`https://openweathermap.org/img/w/${day.weather[0].icon}.png`}
															alt={day.weather[0].description}
															className="w-16 h-16"
														/>
														<div className="text-2xl font-bold">
															{Math.round(day.temp.day)}°C
														</div>
														<div className="text-sm text-gray-600 capitalize">
															{day.weather[0].description}
														</div>
														<div className="flex justify-between w-full text-sm">
															<span>L: {Math.round(day.temp.min)}°C</span>
															<span>H: {Math.round(day.temp.max)}°C</span>
														</div>
														<div className="flex justify-between w-full text-sm">
															<div className="flex items-center gap-1">
																<Droplets className="w-4 h-4" />
																{day.humidity}%
															</div>
															<div className="flex items-center gap-1">
																<CloudRain className="w-4 h-4" />
																{Math.round(day.pop * 100)}%
															</div>
														</div>
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								</TabsContent>

								<TabsContent value="week">
									<div className="bg-white/50 dark:bg-gray-700/50 rounded-lg p-4">
										<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
											{weatherData.daily.slice(1).map((day) => (
												<Card key={day.dt}>
													<CardHeader>
														<CardTitle className="text-sm">
															{new Date(day.dt * 1000).toLocaleDateString("en-US", {
																weekday: "short",
																month: "short",
																day: "numeric",
															})}
														</CardTitle>
													</CardHeader>
													<CardContent>
														<div className="flex flex-col items-center space-y-2">
															<img
																src={`https://openweathermap.org/img/w/${day.weather[0].icon}.png`}
																alt={day.weather[0].description}
																className="w-12 h-12"
															/>
															<div className="text-xl font-bold">
																{Math.round(day.temp.day)}°C
															</div>
															<div className="text-xs text-gray-600 capitalize">
																{day.weather[0].description}
															</div>
															<div className="flex justify-between w-full text-xs">
																<span>L: {Math.round(day.temp.min)}°C</span>
																<span>H: {Math.round(day.temp.max)}°C</span>
															</div>
														</div>
													</CardContent>
												</Card>
											))}
										</div>
									</div>
								</TabsContent>
							</Tabs>
						</CardContent>
					</Card>
				</div>

				{/* Safety Information Section - Now at bottom */}
				<Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-white/20 shadow-lg mt-8">
					<CardHeader>
						<CardTitle className="text-2xl font-bold text-blue-600 dark:text-blue-400">
							Understanding Weather Safety for Survivors
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid md:grid-cols-2 gap-6">
							<div className="space-y-3">
								<h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
									Climate Change & GBV
								</h3>
								<p className="text-gray-600 dark:text-gray-300">
									Extreme weather conditions and climate change can increase
									vulnerability to gender-based violence. During natural disasters,
									floods, or extreme temperatures, survivors may face:
								</p>
								<ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
									<li>Limited access to support services</li>
									<li>Disrupted communication channels</li>
									<li>Increased economic stress</li>
									<li>Forced displacement or unsafe shelter conditions</li>
								</ul>
							</div>
							<div className="space-y-3">
								<h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
									Using Weather Alerts for Safety
								</h3>
								<p className="text-gray-600 dark:text-gray-300">
									Our weather monitoring system helps you:
								</p>
								<ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2">
									<li>Plan safe travel routes and times</li>
									<li>Prepare for extreme weather conditions</li>
									<li>Make informed decisions about shelter and safety</li>
									<li>Stay connected with support networks during severe weather</li>
								</ul>
							</div>
						</div>
						<div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg">
							<p className="text-sm text-blue-600 dark:text-blue-300">
								<strong>Safety Tip:</strong> Save emergency contact numbers and keep
								your devices charged when adverse weather is predicted. If you need
								immediate assistance, contact our 24/7 helpline or local emergency
								services.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default WeatherDashboard;

const WeatherDetail = ({
	icon,
	label,
	value,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
}) => (
	<div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm">
		{icon}
		<div className="text-xs text-gray-600 dark:text-gray-300 mt-1">{label}</div>
		<div className="font-bold text-sm text-gray-800 dark:text-gray-100">
			{value}
		</div>
	</div>
);

const WeatherDetailSkeleton = () => (
	<div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm">
		<Skeleton className="h-5 w-5 rounded-full" />
		<Skeleton className="h-3 w-12 mt-1" />
		<Skeleton className="h-4 w-14 mt-1" />
	</div>
);
