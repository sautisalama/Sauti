"use client";

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, CheckCircle, AlertCircle, X, Camera, File, Eye, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fileUploadService, FileUploadError } from "@/lib/file-upload";
import { cn } from "@/lib/utils";

interface FileUploadProps {
	userId: string;
	userType: "professional" | "ngo" | "survivor";
	fileType: "accreditation" | "profile" | "report";
	serviceId?: string;
	serviceType?: string;
	onUploadSuccess?: (file: { url: string; fileName: string; filePath: string }) => void;
	onUploadError?: (error: string) => void;
	onUploadStart?: (file: File) => void;
	onFileDelete?: (file: { url: string; fileName: string; filePath: string }) => void;
	acceptedTypes?: string[];
	maxSize?: number; // in MB
	multiple?: boolean;
	className?: string;
	placeholder?: string;
	disabled?: boolean;
	autoUpload?: boolean; // Whether to upload immediately when file is selected
	singleMode?: boolean; // Hide upload area after file is uploaded
	showUploadedFiles?: boolean; // Show list of uploaded files
	uploadedFiles?: Array<{ url: string; fileName: string; filePath: string; uploadedAt: string }>;
}

interface UploadedFile {
	file: File;
	url?: string;
	uploading: boolean;
	progress: number;
	error?: string;
	uploaded: boolean;
	fileName?: string;
	filePath?: string;
}

export function MobileFileUpload({
	userId,
	userType,
	fileType,
	serviceId,
	serviceType,
	onUploadSuccess,
	onUploadError,
	onUploadStart,
	onFileDelete,
	acceptedTypes = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"],
	maxSize = 10,
	multiple = false,
	className,
	placeholder = "Tap to select files",
	disabled = false,
	autoUpload = true,
	singleMode = false,
	showUploadedFiles = false,
	uploadedFiles = [],
}: FileUploadProps) {
	const [files, setFiles] = useState<UploadedFile[]>([]);
	const [isDragOver, setIsDragOver] = useState(false);
	const [viewingFile, setViewingFile] = useState<{ url: string; fileName: string; filePath: string; uploadedAt: string } | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { toast } = useToast();

	const validateFile = useCallback((file: File): string | null => {
		// Check file size
		if (file.size > maxSize * 1024 * 1024) {
			return `File size must be less than ${maxSize}MB`;
		}

		// Check file type
		const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
		if (!acceptedTypes.includes(fileExtension)) {
			return `File type not supported. Allowed: ${acceptedTypes.join(", ")}`;
		}

		return null;
	}, [maxSize, acceptedTypes]);

	const uploadFile = useCallback(async (file: File): Promise<void> => {
		// Update file state to uploading
		setFiles(prev => prev.map(f => 
			f.file === file 
				? { ...f, uploading: true, progress: 0, uploaded: false, error: undefined }
				: f
		));

		// Simulate progress updates with more realistic progression
		let currentProgress = 0;
		const progressInterval = setInterval(() => {
			setFiles(prev => prev.map(f => {
				if (f.file === file && f.uploading) {
					// More realistic progress: starts fast, slows down, then speeds up near end
					let increment;
					if (currentProgress < 30) {
						increment = Math.random() * 25 + 15; // 15-40% increments early
					} else if (currentProgress < 70) {
						increment = Math.random() * 10 + 5;  // 5-15% increments middle
					} else if (currentProgress < 90) {
						increment = Math.random() * 5 + 2;   // 2-7% increments slow
					} else {
						increment = Math.random() * 3 + 1;   // 1-4% increments very slow
					}
					
					currentProgress = Math.min(f.progress + increment, 95);
					return { ...f, progress: currentProgress };
				}
				return f;
			}));
		}, 250);

		try {
			const result = await fileUploadService.uploadFile({
				userId,
				userType,
				serviceId,
				serviceType: serviceType as any,
				fileType,
				fileName: file.name,
				file,
			});

			clearInterval(progressInterval);

			// Update progress to 100% immediately
			setFiles(prev => prev.map(f => 
				f.file === file 
					? { ...f, progress: 100 }
					: f
			));

			// Small delay to show 100% progress, then mark as uploaded
			setTimeout(() => {
				setFiles(prev => prev.map(f => 
					f.file === file 
						? { ...f, url: result.url, fileName: result.fileName, filePath: result.filePath, uploading: false, uploaded: true }
						: f
				));
			}, 800);

			onUploadSuccess?.({
				url: result.url,
				fileName: result.fileName,
				filePath: result.filePath,
			});

			toast({
				title: "Upload Successful",
				description: `${file.name} has been uploaded successfully.`,
			});

		} catch (error) {
			clearInterval(progressInterval);
			
			const errorMessage = error instanceof FileUploadError 
				? error.message 
				: "Upload failed. Please try again.";

			// Update file state with error
			setFiles(prev => prev.map(f => 
				f.file === file 
					? { ...f, uploading: false, error: errorMessage, uploaded: false, progress: 0 }
					: f
			));

			onUploadError?.(errorMessage);
			
			toast({
				title: "Upload Failed",
				description: errorMessage,
				variant: "destructive",
			});
		}
	}, [userId, userType, serviceId, serviceType, fileType, onUploadSuccess, onUploadError, toast]);

	const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
		if (!selectedFiles) return;

		const fileArray = Array.from(selectedFiles);
		
		// Validate files first
		for (const file of fileArray) {
			const validationError = validateFile(file);
			if (validationError) {
				toast({
					title: "Invalid File",
					description: `${file.name}: ${validationError}`,
					variant: "destructive",
				});
				return;
			}
		}

		// Check for duplicate files and add only new ones
		setFiles(prev => {
			const existingFiles = prev.map(f => f.file.name + f.file.size);
			const newFiles = fileArray.filter(file => 
				!existingFiles.includes(file.name + file.size)
			);

			if (newFiles.length === 0) {
				toast({
					title: "File Already Added",
					description: "This file has already been added to the upload list.",
					variant: "destructive",
				});
				return prev;
			}

			const newUploadedFiles = newFiles.map(file => ({
				file,
				uploading: false,
				progress: 0,
				uploaded: false,
			}));

			// Notify parent that upload started for new files
			newFiles.forEach(file => onUploadStart?.(file));

			return [...prev, ...newUploadedFiles];
		});

		// Upload files if autoUpload is enabled
		if (autoUpload) {
			fileArray.forEach(file => {
				uploadFile(file);
			});
		}
	}, [validateFile, uploadFile, toast, autoUpload, onUploadStart]);

	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		handleFileSelect(e.target.files);
		// Reset input value to allow selecting the same file again
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}, [handleFileSelect]);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
		handleFileSelect(e.dataTransfer.files);
	}, [handleFileSelect]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	}, []);

	const removeFile = useCallback(async (fileToRemove: File) => {
		const fileData = files.find(f => f.file === fileToRemove);
		
		// If file was uploaded, delete it from bucket
		if (fileData?.uploaded && fileData.url) {
			try {
				await fileUploadService.deleteFile(fileData.url, fileType);
				onFileDelete?.({
					url: fileData.url,
					fileName: fileData.fileName || fileToRemove.name,
					filePath: fileData.filePath || "",
				});
			} catch (error) {
				console.error("Error deleting file from bucket:", error);
				toast({
					title: "Delete Warning",
					description: "File removed from list but may still exist in storage.",
					variant: "destructive",
				});
			}
		}
		
		setFiles(prev => prev.filter(f => f.file !== fileToRemove));
	}, [files, fileType, onFileDelete, toast]);

	const retryUpload = useCallback((file: File) => {
		uploadFile(file);
	}, [uploadFile]);

	const startUpload = useCallback((file: File) => {
		uploadFile(file);
	}, [uploadFile]);

	const cancelUpload = useCallback((file: File) => {
		// Remove file from state if not uploaded yet
		setFiles(prev => prev.filter(f => f.file !== file));
	}, []);

	const getFileStatus = useCallback((file: File) => {
		return files.find(f => f.file === file);
	}, [files]);

	const clearAllFiles = useCallback(async () => {
		// Delete all uploaded files from bucket
		for (const fileData of files) {
			if (fileData.uploaded && fileData.url) {
				try {
					await fileUploadService.deleteFile(fileData.url, fileType);
					onFileDelete?.({
						url: fileData.url,
						fileName: fileData.fileName || fileData.file.name,
						filePath: fileData.filePath || "",
					});
				} catch (error) {
					console.error("Error deleting file from bucket:", error);
				}
			}
		}
		
		setFiles([]);
		toast({
			title: "All Files Cleared",
			description: "All files have been removed and deleted from storage.",
		});
	}, [files, fileType, onFileDelete, toast]);

	const openFileDialog = useCallback(() => {
		if (disabled) return;
		fileInputRef.current?.click();
	}, [disabled]);

	// Check if we should show upload area
	const shouldShowUploadArea = !singleMode || (singleMode && files.length === 0 && uploadedFiles.length === 0);
	const hasUploadedFiles = files.some(f => f.uploaded) || uploadedFiles.length > 0;

	return (
		<div className={cn("space-y-4", className)}>
			{/* File Input Area - Only show if not in single mode or no files uploaded */}
			{shouldShowUploadArea && (
				<Card 
					className={cn(
						"border-2 border-dashed transition-all duration-300 cursor-pointer group",
						isDragOver 
							? "border-sauti-orange bg-gradient-to-br from-orange-50 to-orange-100 shadow-lg scale-[1.02]" 
							: "border-gray-300 hover:border-sauti-orange/50 hover:bg-gray-50",
						disabled && "opacity-50 cursor-not-allowed hover:border-gray-300 hover:bg-transparent"
					)}
					onClick={openFileDialog}
					onDrop={handleDrop}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
				>
					<CardContent className="p-8 text-center">
						<div className="space-y-4">
							{/* Icon Animation */}
							<div className="flex justify-center">
								<div className={cn(
									"p-4 rounded-full transition-all duration-300",
									isDragOver 
										? "bg-sauti-orange/10 scale-110" 
										: "bg-gray-100 group-hover:bg-sauti-orange/5"
								)}>
									<div className="flex space-x-1">
										<Upload className={cn(
											"h-6 w-6 transition-colors duration-300",
											isDragOver ? "text-sauti-orange" : "text-gray-400 group-hover:text-sauti-orange/70"
										)} />
										<Camera className={cn(
											"h-6 w-6 transition-colors duration-300",
											isDragOver ? "text-sauti-orange" : "text-gray-400 group-hover:text-sauti-orange/70"
										)} />
										<File className={cn(
											"h-6 w-6 transition-colors duration-300",
											isDragOver ? "text-sauti-orange" : "text-gray-400 group-hover:text-sauti-orange/70"
										)} />
									</div>
								</div>
							</div>
							
							{/* Text Content */}
							<div className="space-y-2">
								<p className={cn(
									"text-base font-semibold transition-colors duration-300",
									isDragOver ? "text-sauti-orange" : "text-gray-700 group-hover:text-sauti-orange"
								)}>
									{placeholder}
								</p>
								<div className="space-y-1">
									<p className="text-sm text-gray-600">
										{acceptedTypes.join(", ").toUpperCase()}
									</p>
									<p className="text-xs text-gray-500">
										Maximum file size: {maxSize}MB
									</p>
									{!multiple && (
										<p className="text-xs text-gray-400 font-medium">
											Single file only
										</p>
									)}
								</div>
							</div>

							{/* Drag and Drop Hint */}
							<div className="pt-2">
								<p className="text-xs text-gray-400">
									Drag and drop files here, or click to browse
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Hidden File Input */}
			<input
				ref={fileInputRef}
				type="file"
				accept={acceptedTypes.join(",")}
				multiple={multiple}
				onChange={handleInputChange}
				className="hidden"
				disabled={disabled}
			/>

			{/* Uploaded Files Display */}
			{showUploadedFiles && uploadedFiles.length > 0 && (
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h4 className="text-sm font-semibold text-gray-700">
							Uploaded Files ({uploadedFiles.length})
						</h4>
					</div>
					
					<div className="space-y-3">
						{uploadedFiles.map((fileData, index) => (
							<Card key={`uploaded-${index}`} className="p-4 bg-green-50 border-green-200 hover:shadow-md transition-shadow">
								<div className="space-y-3">
									{/* Header with icon and status */}
									<div className="flex items-center space-x-3">
										<div className="flex-shrink-0">
											<div className="p-2 rounded-full bg-green-100">
												<CheckCircle className="h-5 w-5 text-green-600" />
											</div>
										</div>

										<div className="flex-1 min-w-0">
											<div className="flex items-center space-x-2">
												<p className="text-sm font-medium text-gray-900 truncate">
													{fileData.fileName}
												</p>
												<Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
													Uploaded
												</Badge>
											</div>
										</div>

										<div className="flex-shrink-0 flex space-x-1">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setViewingFile(fileData)}
												className="text-sauti-orange hover:text-sauti-orange/80 border-sauti-orange/20 hover:border-sauti-orange/40"
											>
												<Eye className="h-4 w-4 mr-1" />
												View
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => {
													// Handle delete uploaded file
													onFileDelete?.(fileData);
												}}
												className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									</div>

									{/* File Details */}
									<div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
										<div>
											<span className="font-medium">File Type:</span>
											<p className="capitalize">{fileData.fileName.split('.').pop()?.toUpperCase()}</p>
										</div>
										<div>
											<span className="font-medium">Upload Date:</span>
											<p>{new Date(fileData.uploadedAt).toLocaleDateString()}</p>
										</div>
										<div>
											<span className="font-medium">Upload Time:</span>
											<p>{new Date(fileData.uploadedAt).toLocaleTimeString()}</p>
										</div>
										<div>
											<span className="font-medium">Status:</span>
											<p className="text-green-600 font-medium">Ready for Review</p>
										</div>
									</div>

								</div>
							</Card>
						))}
					</div>
				</div>
			)}

			{/* File List */}
			{files.length > 0 && (
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h4 className="text-sm font-semibold text-gray-700">
							Selected Files ({files.length})
						</h4>
						<div className="flex items-center space-x-2">
							{files.some(f => f.uploading) && (
								<div className="flex items-center space-x-1 text-xs text-sauti-orange">
									<div className="animate-spin rounded-full h-3 w-3 border-b-2 border-sauti-orange"></div>
									<span>Uploading...</span>
								</div>
							)}
							{files.length > 1 && (
								<Button
									variant="outline"
									size="sm"
									onClick={clearAllFiles}
									disabled={files.some(f => f.uploading)}
									className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
								>
									Clear All
								</Button>
							)}
						</div>
					</div>
					
					<div className="space-y-2">
						{files.map((fileData, index) => (
							<Card 
								key={`${fileData.file.name}-${fileData.file.size}-${index}`} 
								className={cn(
									"p-4 transition-all duration-200 hover:shadow-md",
									fileData.uploaded && "bg-green-50 border-green-200",
									fileData.error && "bg-red-50 border-red-200",
									fileData.uploading && "bg-orange-50 border-orange-200"
								)}
							>
								<div className="flex items-center space-x-3">
									{/* Status Icon */}
									<div className="flex-shrink-0">
										{fileData.uploaded ? (
											<div className="p-2 rounded-full bg-green-100">
												<CheckCircle className="h-5 w-5 text-green-600" />
											</div>
										) : fileData.error ? (
											<div className="p-2 rounded-full bg-red-100">
												<AlertCircle className="h-5 w-5 text-red-600" />
											</div>
										) : fileData.uploading ? (
											<div className="p-2 rounded-full bg-orange-100">
												<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sauti-orange"></div>
											</div>
										) : (
											<div className="p-2 rounded-full bg-blue-100">
												<FileText className="h-5 w-5 text-blue-600" />
											</div>
										)}
									</div>

									{/* File Info */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center space-x-2">
											<p className="text-sm font-medium text-gray-900 truncate">
												{fileData.file.name}
											</p>
											{fileData.uploaded && (
												<Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
													Uploaded
												</Badge>
											)}
										</div>
										
										<div className="flex items-center space-x-2 mt-1">
											<p className="text-xs text-gray-500">
												{(fileData.file.size / 1024 / 1024).toFixed(2)} MB
											</p>
											{fileData.uploading && (
												<p className="text-xs text-sauti-orange font-medium">
													{fileData.progress}% complete
												</p>
											)}
										</div>
										
										{fileData.uploading && (
											<div className="mt-2">
												<Progress 
													value={fileData.progress} 
													className="h-2 bg-gray-200"
												/>
											</div>
										)}

										{fileData.error && (
											<p className="text-xs text-red-600 mt-1 font-medium">
												{fileData.error}
											</p>
										)}
									</div>

									{/* Action Buttons */}
									<div className="flex-shrink-0 flex space-x-1">
										{fileData.error ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => retryUpload(fileData.file)}
												className="text-sauti-orange hover:text-sauti-orange/80 border-sauti-orange/20 hover:border-sauti-orange/40"
											>
												Retry
											</Button>
										) : fileData.uploading ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => cancelUpload(fileData.file)}
												className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
											>
												Cancel
											</Button>
										) : !fileData.uploaded ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => startUpload(fileData.file)}
												className="text-sauti-orange hover:text-sauti-orange/80 border-sauti-orange/20 hover:border-sauti-orange/40"
											>
												Upload
											</Button>
										) : null}
										
										<Button
											variant="ghost"
											size="sm"
											onClick={() => removeFile(fileData.file)}
											className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2"
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</Card>
						))}
					</div>
				</div>
			)}

			{/* Document Viewer Modal */}
			<Dialog open={!!viewingFile} onOpenChange={() => setViewingFile(null)}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
					<DialogHeader>
						<DialogTitle className="flex items-center space-x-2">
							<Eye className="h-5 w-5 text-sauti-orange" />
							<span>Document Viewer</span>
						</DialogTitle>
					</DialogHeader>
					
					{viewingFile && (
						<div className="space-y-4">
							{/* File Info Header */}
							<div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
								<div className="flex items-center space-x-3">
									<div className="p-2 rounded-full bg-green-100">
										<CheckCircle className="h-5 w-5 text-green-600" />
									</div>
									<div>
										<h3 className="font-medium text-gray-900">{viewingFile.fileName}</h3>
										<p className="text-sm text-gray-500">
											Uploaded on {new Date(viewingFile.uploadedAt).toLocaleDateString()} at {new Date(viewingFile.uploadedAt).toLocaleTimeString()}
										</p>
									</div>
								</div>
								<div className="flex space-x-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => window.open(viewingFile.url, '_blank')}
										className="text-sauti-orange hover:text-sauti-orange/80"
									>
										<Download className="h-4 w-4 mr-1" />
										Download
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setViewingFile(null)}
									>
										Close
									</Button>
								</div>
							</div>

							{/* Document Viewer */}
							<div className="border rounded-lg overflow-hidden">
								{viewingFile.fileName.toLowerCase().match(/\.(pdf)$/) ? (
									<iframe
										src={viewingFile.url}
										className="w-full h-[600px] border-0"
										title={viewingFile.fileName}
									/>
								) : viewingFile.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
									<div className="flex items-center justify-center bg-gray-100 p-8">
										<img
											src={viewingFile.url}
											alt={viewingFile.fileName}
											className="max-w-full max-h-[600px] object-contain rounded-lg shadow-lg"
										/>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center p-8 bg-gray-100 h-[400px]">
										<FileText className="h-16 w-16 text-gray-400 mb-4" />
										<h3 className="text-lg font-medium text-gray-900 mb-2">
											Preview Not Available
										</h3>
										<p className="text-gray-500 text-center mb-4">
											This file type cannot be previewed in the browser.
										</p>
										<Button
											onClick={() => window.open(viewingFile.url, '_blank')}
											className="bg-sauti-orange hover:bg-sauti-orange/90"
										>
											<Download className="h-4 w-4 mr-2" />
											Download to View
										</Button>
									</div>
								)}
							</div>

							{/* File Details */}
							<div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg text-sm">
								<div>
									<span className="font-medium text-gray-700">File Type:</span>
									<p className="text-gray-600">{viewingFile.fileName.split('.').pop()?.toUpperCase()}</p>
								</div>
								<div>
									<span className="font-medium text-gray-700">Status:</span>
									<p className="text-green-600 font-medium">Ready for Review</p>
								</div>
								<div>
									<span className="font-medium text-gray-700">File Path:</span>
									<p className="text-gray-600 font-mono text-xs truncate">{viewingFile.filePath}</p>
								</div>
								<div>
									<span className="font-medium text-gray-700">Upload ID:</span>
									<p className="text-gray-600 font-mono text-xs">{viewingFile.fileName.split('_').pop()?.split('.')[0]}</p>
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}