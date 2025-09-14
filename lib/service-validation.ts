import { Database } from "@/types/db-schema";

type SupportServiceType = Database["public"]["Enums"]["support_service_type"];
type UserType = Database["public"]["Enums"]["user_type"];

export interface ServiceValidationResult {
	valid: boolean;
	reason?: string;
	suggestions?: string[];
}

export class ServiceValidationError extends Error {
	constructor(message: string, public suggestions?: string[]) {
		super(message);
		this.name = "ServiceValidationError";
	}
}

export class ServiceValidationService {
	// Define related service fields that NGOs cannot mix
	private readonly RELATED_FIELDS = {
		legal: ["legal"],
		medical: ["medical", "mental_health"],
		mental_health: ["medical", "mental_health"],
		shelter: ["shelter", "financial_assistance"],
		financial_assistance: ["shelter", "financial_assistance"],
		other: ["other"],
	};

	// Define service field descriptions for better user experience
	private readonly FIELD_DESCRIPTIONS = {
		legal: "Legal Services",
		medical: "Medical Services",
		mental_health: "Mental Health Services",
		shelter: "Shelter Services",
		financial_assistance: "Financial Assistance",
		other: "Other Services",
	};

	/**
	 * Validates if a user can create a new service based on their existing services
	 */
	validateServiceCreation(
		existingServices: SupportServiceType[],
		newServiceType: SupportServiceType,
		userType: UserType
	): ServiceValidationResult {
		// Only NGO users can have multiple services
		if (userType !== "ngo" && existingServices.length > 0) {
			return {
				valid: false,
				reason:
					"Only NGO users can create multiple services. Please contact support to upgrade your account.",
				suggestions: [
					"Contact support to upgrade to NGO account",
					"Delete existing service before creating a new one",
				],
			};
		}

		// For NGO users, check if they're trying to create services in related fields
		if (userType === "ngo" && existingServices.length > 0) {
			const existingFieldGroups = this.getFieldGroups(existingServices);
			const newFieldGroup = this.getFieldGroup(newServiceType);

			// Check if new service is in a different field group
			if (newFieldGroup && existingFieldGroups.includes(newFieldGroup)) {
				const conflictingServices = existingServices.filter((service) =>
					this.RELATED_FIELDS[newFieldGroup].includes(service)
				);

				return {
					valid: false,
					reason: `Cannot create ${this.FIELD_DESCRIPTIONS[newServiceType]} service - you already have services in the ${this.FIELD_DESCRIPTIONS[newFieldGroup]} field`,
					suggestions: [
						`Consider consolidating your ${this.FIELD_DESCRIPTIONS[newFieldGroup]} services`,
						"Create a separate NGO account for different service fields",
						`Remove existing ${conflictingServices
							.map((s) => this.FIELD_DESCRIPTIONS[s])
							.join(", ")} services first`,
					],
				};
			}
		}

		return { valid: true };
	}

	/**
	 * Gets the field group for a service type
	 */
	private getFieldGroup(serviceType: SupportServiceType): string | null {
		for (const [field, services] of Object.entries(this.RELATED_FIELDS)) {
			if (services.includes(serviceType)) {
				return field;
			}
		}
		return null;
	}

	/**
	 * Gets all field groups for existing services
	 */
	private getFieldGroups(services: SupportServiceType[]): string[] {
		const fieldGroups = new Set<string>();
		for (const service of services) {
			const fieldGroup = this.getFieldGroup(service);
			if (fieldGroup) {
				fieldGroups.add(fieldGroup);
			}
		}
		return Array.from(fieldGroups);
	}

	/**
	 * Validates service type compatibility for document uploads
	 */
	validateDocumentUpload(
		serviceType: SupportServiceType,
		documentType: string,
		userType: UserType
	): ServiceValidationResult {
		// Define required document types for each service
		const requiredDocuments = {
			legal: ["license", "certification", "bar_admission"],
			medical: ["license", "certification", "medical_degree"],
			mental_health: ["license", "certification", "psychology_degree"],
			shelter: ["registration", "accreditation", "facility_license"],
			financial_assistance: ["registration", "accreditation", "financial_license"],
			other: ["registration", "accreditation"],
		};

		const required = requiredDocuments[serviceType] || [];

		if (required.length === 0) {
			return {
				valid: false,
				reason: "Invalid service type for document upload",
				suggestions: ["Please select a valid service type"],
			};
		}

		return { valid: true };
	}

	/**
	 * Gets suggested service types based on existing services
	 */
	getSuggestedServiceTypes(
		existingServices: SupportServiceType[]
	): SupportServiceType[] {
		const allServiceTypes: SupportServiceType[] = [
			"legal",
			"medical",
			"mental_health",
			"shelter",
			"financial_assistance",
			"other",
		];

		const existingFieldGroups = this.getFieldGroups(existingServices);
		const availableFieldGroups = Object.keys(this.RELATED_FIELDS).filter(
			(field) => !existingFieldGroups.includes(field)
		);

		return allServiceTypes.filter((serviceType) => {
			const fieldGroup = this.getFieldGroup(serviceType);
			return fieldGroup && availableFieldGroups.includes(fieldGroup);
		});
	}

	/**
	 * Validates if a user can upload documents for a specific service
	 */
	validateDocumentAccess(
		userId: string,
		serviceId: string,
		userType: UserType
	): ServiceValidationResult {
		// This would typically check database permissions
		// For now, we'll implement basic validation

		if (userType === "survivor") {
			return {
				valid: false,
				reason: "Survivors cannot upload accreditation documents",
				suggestions: [
					"Only professionals and NGOs can upload accreditation documents",
				],
			};
		}

		return { valid: true };
	}

	/**
	 * Gets field group information for display
	 */
	getFieldGroupInfo(fieldGroup: string) {
		return {
			name:
				this.FIELD_DESCRIPTIONS[
					fieldGroup as keyof typeof this.FIELD_DESCRIPTIONS
				] || fieldGroup,
			services:
				this.RELATED_FIELDS[fieldGroup as keyof typeof this.RELATED_FIELDS] || [],
			description: this.getFieldGroupDescription(fieldGroup),
		};
	}

	private getFieldGroupDescription(fieldGroup: string): string {
		const descriptions = {
			legal:
				"Legal services including court representation, legal advice, and advocacy",
			medical:
				"Medical and healthcare services including physical and mental health support",
			mental_health:
				"Mental health services including counseling, therapy, and psychological support",
			shelter:
				"Shelter and housing services including emergency accommodation and housing support",
			financial_assistance:
				"Financial assistance services including grants, loans, and financial counseling",
			other: "Other specialized services not covered by the main categories",
		};

		return (
			descriptions[fieldGroup as keyof typeof descriptions] ||
			"Specialized services"
		);
	}
}

// Export singleton instance
export const serviceValidationService = new ServiceValidationService();
