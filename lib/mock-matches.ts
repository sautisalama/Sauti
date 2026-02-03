export interface MockProvider {
    id: string;
    name: string;
    type: string;
    phone: string;
    address: string;
    description: string;
    availability: string;
    focus_groups: string[];
}

export const MOCK_PROVIDERS: Record<string, MockProvider[]> = {
    physical: [
        {
            id: "p1",
            name: "Safe Havens Medical Center",
            type: "Medical Support",
            phone: "+254 711 000 111",
            address: "Upper Hill Road, Nairobi",
            description: "Specialized in trauma-informed emergency medical care and physical rehabilitation.",
            availability: "24/7 Emergency Care",
            focus_groups: ["Adults", "Refugees", "LGBTQ+"]
        },
        {
            id: "p2",
            name: "Legal Voice Kenya",
            type: "Legal Aid",
            phone: "+254 722 333 444",
            address: "Kimathi Street, City Centre",
            description: "Providing legal representation and protection orders for survivors of physical abuse.",
            availability: "Mon-Fri, 8 AM - 5 PM",
            focus_groups: ["Women", "Youth"]
        },
        {
            id: "p3",
            name: "Hekima Shelter Home",
            type: "Emergency Shelter",
            phone: "+254 744 111 222",
            address: "Secret Location (Nairobi West)",
            description: "Secure, undisclosed emergency housing for those in immediate physical danger.",
            availability: "24/7 Intake",
            focus_groups: ["Women", "Children"]
        }
    ],
    sexual: [
        {
            id: "s1",
            name: "Resilience Resource Centre",
            type: "Counselling",
            phone: "+254 733 555 666",
            address: "Kilimani Area, Nairobi",
            description: "Expert psychological support and survivor-led recovery groups.",
            availability: "Mon-Sat, 9 AM - 6 PM",
            focus_groups: ["All Survivors"]
        },
        {
            id: "s2",
            name: "Gender-Based Violence Unit",
            type: "Specialized Police Unit",
            phone: "999 / 112",
            address: "Central Police Station (Dedicated Desk)",
            description: "Safe environment for reporting and immediate forensic medical coordination.",
            availability: "24/7",
            focus_groups: ["All Survivors"]
        },
        {
            id: "s3",
            name: "Rainbow Refuge Shelter",
            type: "Inclusve Shelter",
            phone: "+254 755 888 999",
            address: "Undisclosed Location (Nairobi)",
            description: "Safe housing specifically designed for LGBTQ+ survivors of sexual violence.",
            availability: "24/7 Support",
            focus_groups: ["LGBTQ+", "Men", "Non-binary"]
        }
    ],
    emotional: [
        {
            id: "e1",
            name: "Mindful Support Network",
            type: "Mental Health",
            phone: "+254 700 888 999",
            address: "Westlands, Nairobi",
            description: "Trauma-informed cognitive behavioral therapy and emotional wellness coaching.",
            availability: "By Appointment",
            focus_groups: ["All Survivors"]
        },
        {
            id: "e2",
            name: "The Healing Circle",
            type: "Support Group",
            phone: "+254 799 444 333",
            address: "Virtual & In-person (Lavington)",
            description: "Community-led emotional support and healing through shared experiences.",
            availability: "Weekly Sessions",
            focus_groups: ["Youth", "Student Survivors"]
        }
    ],
    financial: [
        {
            id: "f1",
            name: "Economic Empowerment NGO",
            type: "Financial Aid",
            phone: "+254 755 111 222",
            address: "Industrial Area, Nairobi",
            description: "Emergency financial grants and economic independence training programs.",
            availability: "Tue & Thu, 10 AM - 4 PM",
            focus_groups: ["Single Parents", "Women"]
        },
        {
            id: "f2",
            name: "Sauti Startups Fund",
            type: "Micro-loans",
            phone: "+254 766 000 777",
            address: "Morningside Office Park",
            description: "Interest-free micro-loans for survivors starting small businesses.",
            availability: "Mon-Fri, 9 AM - 4 PM",
            focus_groups: ["Entrepreneurs", "Youth"]
        }
    ],
    child_abuse: [
        {
            id: "c1",
            name: "Children's Protection Services",
            type: "Child Welfare",
            phone: "116 (Childline)",
            address: "Museum Hill Road, Nairobi",
            description: "Government-authorized child protection and safe shelter coordination.",
            availability: "24/7 Helpline",
            focus_groups: ["Minors", "Families"]
        },
        {
            id: "c2",
            name: "Little Stars Safe House",
            type: "Children's Shelter",
            phone: "+254 788 999 000",
            address: "Karen, Nairobi",
            description: "Secure residential care for children removed from abusive environments.",
            availability: "24/7",
            focus_groups: ["Children under 12"]
        }
    ],
    other: [
        {
            id: "o1",
            name: "Community Support Hub",
            type: "General Support",
            phone: "+254 799 000 000",
            address: "All major subdivisions",
            description: "Connecting individuals with local community resources and emergency aid.",
            availability: "Daily, 8 AM - 8 PM",
            focus_groups: ["General Public"]
        }
    ]
};

export function getMockMatches(incidentType: string | null): MockProvider[] {
    const type = incidentType?.toLowerCase() || 'other';
    // Return all matches for that type to allow "Next Match" cycling
    return MOCK_PROVIDERS[type] || MOCK_PROVIDERS['other'];
}
