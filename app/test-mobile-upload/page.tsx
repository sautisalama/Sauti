"use client";

import { MobileFileUpload } from "@/components/ui/mobile-file-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestMobileUploadPage() {
	const handleUploadSuccess = (fileData: { url: string; fileName: string; filePath: string }) => {
		console.log("Upload successful:", fileData);
		alert(`File uploaded successfully: ${fileData.fileName}`);
	};

	const handleUploadError = (error: string) => {
		console.error("Upload error:", error);
		alert(`Upload failed: ${error}`);
	};

	const handleUploadStart = (file: File) => {
		console.log("Upload started:", file.name);
	};

	return (
		<div className="container mx-auto p-4 max-w-2xl">
			<Card>
				<CardHeader>
					<CardTitle>Mobile File Upload Test</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-6">
						<div>
							<h3 className="text-lg font-medium mb-2">Single File Upload (Auto Upload)</h3>
							<MobileFileUpload
								userId="test-user-id"
								userType="professional"
								fileType="accreditation"
								onUploadSuccess={handleUploadSuccess}
								onUploadError={handleUploadError}
								onUploadStart={handleUploadStart}
								acceptedTypes={[".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"]}
								maxSize={10}
								placeholder="Tap to upload a single file"
								autoUpload={true}
							/>
						</div>

						<div>
							<h3 className="text-lg font-medium mb-2">Multiple File Upload (Auto Upload)</h3>
							<MobileFileUpload
								userId="test-user-id"
								userType="professional"
								fileType="accreditation"
								onUploadSuccess={handleUploadSuccess}
								onUploadError={handleUploadError}
								onUploadStart={handleUploadStart}
								acceptedTypes={[".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"]}
								maxSize={10}
								multiple={true}
								placeholder="Tap to upload multiple files"
								autoUpload={true}
							/>
						</div>

						<div>
							<h3 className="text-lg font-medium mb-2">Manual Upload (No Auto Upload)</h3>
							<MobileFileUpload
								userId="test-user-id"
								userType="professional"
								fileType="profile"
								onUploadSuccess={handleUploadSuccess}
								onUploadError={handleUploadError}
								onUploadStart={handleUploadStart}
								acceptedTypes={[".jpg", ".jpeg", ".png", ".webp"]}
								maxSize={5}
								placeholder="Tap to select files (manual upload)"
								autoUpload={false}
							/>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
