import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, signInWithGoogle } from "@/app/(auth)/actions/auth";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export default function SignUp() {
	return (
		<div className="flex flex-col min-h-screen bg-serene-neutral-50">
			<div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
				<div className="hidden lg:block relative">
					<Image
						src="/couple-salama.jpg"
						alt="Sauti Salama Community"
						fill
						className="object-cover"
                        priority
					/>
                    <div className="absolute inset-0 bg-gradient-to-t from-sauti-blue/40 via-transparent to-transparent" />
                    <div className="absolute bottom-12 left-12 right-12 text-white">
                        <h2 className="text-3xl font-serif font-bold mb-4">Join Our Community of Care.</h2>
                        <p className="text-lg font-medium text-white/90 max-w-md">
                            Together, we can provide the support and resources needed to empower every survivor.
                        </p>
                    </div>
				</div>
				<div className="flex items-center justify-center p-8 lg:p-12">
					<div className="mx-auto w-full max-w-[450px] space-y-8">
						<div className="space-y-3 text-center lg:text-left">
                            <div className="inline-flex items-center justify-center h-18 w-18 rounded-2xl bg-sauti-blue/10 mb-2 lg:mb-4">
                                <Image 
                                    src="/Logo.png" 
                                    alt="Sauti Salama" 
                                    width={100} 
                                    height={100}
                                    className="object-contain"
                                />
                            </div>
							<h1 className="text-4xl font-serif font-bold text-serene-neutral-900 tracking-tight">
                                Create Account
                            </h1>
							<p className="text-serene-neutral-500 font-medium">
								Join Sauti Salama and start making a difference today
							</p>
						</div>

                        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl border border-serene-neutral-100 shadow-xl shadow-serene-neutral-200/50 space-y-6">
                            <form action={signUp} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName" className="text-sm font-semibold text-serene-neutral-700 ml-1">
                                            First Name
                                        </Label>
                                        <Input 
                                            name="firstName" 
                                            id="firstName" 
                                            type="text" 
                                            required 
                                            className="h-11 bg-serene-neutral-50 border-sauti-teal/50 rounded-xl focus-visible:ring-sauti-blue/20 focus-visible:border-sauti-blue transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="lastName" className="text-sm font-semibold text-serene-neutral-700 ml-1">
                                            Last Name
                                        </Label>
                                        <Input 
                                            name="lastName" 
                                            id="lastName" 
                                            type="text" 
                                            required 
                                            className="h-11 bg-serene-neutral-50 border-sauti-teal/50 rounded-xl focus-visible:ring-sauti-blue/20 focus-visible:border-sauti-blue transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-sm font-semibold text-serene-neutral-700 ml-1">
                                        Email Address
                                    </Label>
                                    <Input
                                        name="email"
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        required
                                        className="h-11 bg-serene-neutral-50 border-sauti-teal/50 rounded-xl focus-visible:ring-sauti-blue/20 focus-visible:border-sauti-blue transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-sm font-semibold text-serene-neutral-700 ml-1">
                                        Password
                                    </Label>
                                    <Input 
                                        name="password" 
                                        id="password" 
                                        type="password" 
                                        required 
                                        className="h-11 bg-serene-neutral-50 border-sauti-teal/50 rounded-xl focus-visible:ring-sauti-blue/20 focus-visible:border-sauti-blue transition-all"
                                    />
                                </div>
                                <Button 
                                    type="submit" 
                                    className="w-full h-12 bg-sauti-blue hover:bg-sauti-blue/90 text-white font-bold rounded-xl shadow-lg shadow-sauti-blue/20 transition-all active:scale-[0.98] mt-2"
                                >
                                    Create Account
                                </Button>
                            </form>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-serene-neutral-100" />
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="bg-white px-3 text-serene-neutral-400 font-medium">Or join with</span>
                                </div>
                            </div>

                            <form action={signInWithGoogle}>
                                <Button 
                                    variant="outline" 
                                    className="w-full h-12 bg-white border-sauti-teal/50 text-serene-neutral-700 font-semibold rounded-xl hover:bg-serene-neutral-50 transition-all flex items-center justify-center gap-3" 
                                    type="submit"
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    Google
                                </Button>
                            </form>
                        </div>

						<div className="text-center text-sm font-medium text-serene-neutral-500">
							Already have an account?{" "}
							<Link href="/signin" className="text-sauti-blue font-bold hover:underline underline-offset-4">
								Log In
							</Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

