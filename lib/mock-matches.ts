export interface MockProvider {
    id: string;
    name: string;
    type: string;
    phone: string;
    address: string;
    description: string;
    availability: string;
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
            availability: "24/7 Emergency Care"
        },
        {
            id: "p2",
            name: "Legal Voice Kenya",
            type: "Legal Aid",
            phone: "+254 722 333 444",
            address: "Kimathi Street, City Centre",
            description: "Providing legal representation and protection orders for survivors of physical abuse.",
            availability: "Mon-Fri, 8 AM - 5 PM"
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
            availability: "Mon-Sat, 9 AM - 6 PM"
        },
        {
            id: "s2",
            name: "Gender-Based Violence Unit",
            type: "Specialized Police Unit",
            phone: "999 / 112",
            address: "Central Police Station (Dedicated Desk)",
            description: "Safe environment for reporting and immediate forensic medical coordination.",
            availability: "24/7"
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
            availability: "By Appointment"
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
            availability: "Tue & Thu, 10 AM - 4 PM"
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
            availability: "24/7 Helpline"
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
            availability: "Daily, 8 AM - 8 PM"
        }
    ]
};

export function getMockMatches(incidentType: string | null): MockProvider[] {
    const type = incidentType?.toLowerCase() || 'other';
    return MOCK_PROVIDERS[type] || MOCK_PROVIDERS['other'];
}
