"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Search,
    Plus,
    Edit,
    Trash2,
    Calendar,
    FileText,
    ExternalLink,
    MapPin,
    Video
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Interface reflecting the DB schema
interface BlogPost {
    id: string;
    title: string;
    content: string; // HTML/Rich Text or Markdown
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published';
    created_at: string;
    published_at: string | null;
    author_id: string;
    is_event: boolean;
    event_details: {
        event_date: string;
        location: string;
        is_virtual: boolean;
        meeting_link?: string;
        cta_text?: string;
        cta_link?: string;
    } | null;
    cover_image_url?: string;
}

export function BlogManager() {
    const [posts, setPosts] = useState<BlogPost[]>([]);
	const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState<'all' | 'blog' | 'event'>("all");
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Editor Form State
    const [formData, setFormData] = useState<Partial<BlogPost>>({
        title: "",
        content: "",
        status: "draft",
        is_event: false,
        event_details: null
    });

	const supabase = createClient();
	const { toast } = useToast();

	useEffect(() => {
		loadPosts();
	}, []);

	const loadPosts = async () => {
		try {
			setIsLoading(true);
			const { data, error } = await supabase
				.from("blogs")
				.select("*")
				.order("created_at", { ascending: false });

			if (error) throw error;
			setPosts(data as BlogPost[]);
		} catch (error) {
			console.error("Error loading posts:", error);
			toast({
				title: "Error",
				description: "Failed to load content",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

    const handleCreateNew = () => {
        setEditingPost(null);
        setFormData({
            title: "",
            content: "",
            status: "draft",
            is_event: false,
            event_details: null // Or init with empty object if easier
        });
        setIsEditorOpen(true);
    };

    const handleEdit = (post: BlogPost) => {
        setEditingPost(post);
        setFormData({
            title: post.title,
            content: post.content,
            status: post.status,
            is_event: post.is_event,
            event_details: post.event_details || null
        });
        setIsEditorOpen(true);
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const postData = {
                title: formData.title,
                content: formData.content,
                status: formData.status,
                is_event: formData.is_event,
                event_details: formData.is_event ? formData.event_details : null,
                author_id: editingPost ? editingPost.author_id : user.id,
                updated_at: new Date().toISOString(),
                ...(formData.status === 'published' && (!editingPost?.published_at) && { published_at: new Date().toISOString() })
            };

            let error;
            if (editingPost) {
                const { error: updateError } = await supabase
                    .from("blogs")
                    .update(postData)
                    .eq("id", editingPost.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from("blogs")
                    .insert([postData]);
                error = insertError;
            }

            if (error) throw error;

            toast({
                title: "Success",
                description: `Content ${editingPost ? "updated" : "created"} successfully`
            });
            setIsEditorOpen(false);
            loadPosts();

        } catch (error) {
            console.error("Error saving post:", error);
            toast({
                title: "Error",
                description: "Failed to save content",
                variant: 'destructive'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this content?")) return;
        try {
             const { error } = await supabase.from("blogs").delete().eq("id", id);
             if (error) throw error;
             toast({ title: "Deleted", description: "Content deleted successfully" });
             loadPosts();
        } catch(error) {
             console.error("Error deleting:", error);
             toast({ title: "Error", variant: "destructive" });
        }
    };

    const filteredPosts = posts.filter(post => {
        const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' 
            ? true 
            : typeFilter === 'event' 
                ? post.is_event 
                : !post.is_event;
        return matchesSearch && matchesType;
    });

    const updateEventDetail = (key: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            event_details: {
                ...prev.event_details!,
                [key]: value
            }
        }));
    };

	return (
		<Card className="border-serene-neutral-200/60 shadow-sm rounded-2xl overflow-hidden">
			<CardHeader className="bg-white border-b border-serene-neutral-100">
                <div className="flex items-center justify-between">
				    <CardTitle className="text-xl font-bold text-serene-neutral-900">Content Management</CardTitle>
                    <Button onClick={handleCreateNew} className="bg-serene-blue-600 hover:bg-serene-blue-700 text-white rounded-xl shadow-md shadow-serene-blue-200 transition-all hover:shadow-lg">
                        <Plus className="mr-2 h-4 w-4" />
                        Create New
                    </Button>
                </div>
				<CardDescription className="text-serene-neutral-500">
					Manage blogs, articles, and upcoming events
				</CardDescription>
			</CardHeader>
			<CardContent className="p-6 space-y-6">
                {/* Filters */}
				<div className="flex flex-col sm:flex-row items-center gap-4">
					<div className="relative flex-1 w-full">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-serene-neutral-400 h-4 w-4" />
						<Input
							placeholder="Search content..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10 rounded-full bg-serene-neutral-50 border-serene-neutral-200 focus:bg-white transition-all"
						/>
					</div>
                    <div className="flex items-center gap-1 bg-serene-neutral-50 p-1 rounded-xl border border-serene-neutral-200/50">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setTypeFilter('all')}
                            className={`rounded-lg transition-all ${typeFilter === 'all' ? 'bg-white text-serene-blue-600 shadow-sm font-bold' : 'text-serene-neutral-500 hover:text-serene-neutral-700'}`}
                        >All</Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setTypeFilter('blog')}
                            className={`rounded-lg transition-all ${typeFilter === 'blog' ? 'bg-white text-serene-blue-600 shadow-sm font-bold' : 'text-serene-neutral-500 hover:text-serene-neutral-700'}`}
                        >Blogs</Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setTypeFilter('event')}
                            className={`rounded-lg transition-all ${typeFilter === 'event' ? 'bg-white text-serene-blue-600 shadow-sm font-bold' : 'text-serene-neutral-500 hover:text-serene-neutral-700'}`}
                        >Events</Button>
                    </div>
				</div>

                {/* Table */}
                <div className="border border-serene-neutral-200 rounded-xl overflow-hidden">
					<Table>
						<TableHeader className="bg-serene-neutral-50/80 backdrop-blur-sm">
							<TableRow className="hover:bg-transparent border-b border-serene-neutral-200">
								<TableHead className="font-bold text-serene-neutral-600 pl-6">Title</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Type</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Status</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Author</TableHead>
								<TableHead className="font-bold text-serene-neutral-600">Date</TableHead>
								<TableHead className="text-right font-bold text-serene-neutral-600 pr-6">Actions</TableHead>
							</TableRow>
						</TableHeader>
                        <TableBody>
                            {filteredPosts.map(post => (
                                <TableRow key={post.id}>
                                    <TableCell className="font-medium pl-6">
                                        {post.title}
                                        {post.is_event && post.event_details && (
                                            <div className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(post.event_details.event_date).toLocaleDateString()}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={post.is_event ? "default" : "secondary"} className={post.is_event ? "bg-sauti-orange/10 text-sauti-orange border border-sauti-orange/20 shadow-sm hover:bg-sauti-orange/20" : "bg-serene-neutral-100 text-serene-neutral-600 border border-serene-neutral-200"}>
                                            {post.is_event ? "Event" : "Blog"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`capitalize
                                            ${post.status === 'published' ? 'text-green-600 border-green-200 bg-green-50 shadow-sm' : ''}
                                            ${post.status === 'draft' ? 'text-neutral-500 border-neutral-200 bg-neutral-50' : ''}
                                            ${post.status === 'pending_review' ? 'text-amber-600 border-amber-200 bg-amber-50 shadow-sm' : ''}
                                        `}>
                                            {post.status.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-neutral-500">
                                        {/* Ideally fetch author name, simplistic for now */}
                                        Admin
                                    </TableCell>
                                    <TableCell className="text-sm text-neutral-500">
                                        {new Date(post.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(post)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(post.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Edit/Create Modal */}
            <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingPost ? "Edit Content" : "Create New Content"}</DialogTitle>
                        <DialogDescription>
                            Create or edit blogs and events.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Title</label>
                            <Input 
                                value={formData.title} 
                                onChange={(e) => setFormData(prev => ({...prev, title: e.target.value}))}
                                placeholder="Enter title"
                            />
                        </div>

                        {/* Event Toggle */}
                         <div className="flex items-center space-x-2 border p-3 rounded-lg bg-neutral-50">
                            <Checkbox 
                                id="is_event" 
                                checked={formData.is_event}
                                onCheckedChange={(checked) => {
                                    setFormData(prev => ({
                                        ...prev, 
                                        is_event: !!checked,
                                        event_details: checked ? (prev.event_details || {
                                            event_date: new Date().toISOString().split('T')[0],
                                            location: "",
                                            is_virtual: false
                                        }) : null
                                    }));
                                }}
                            />
                            <label htmlFor="is_event" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                This is an Event
                            </label>
                        </div>

                        {/* Event Details Section */}
                        {formData.is_event && formData.event_details && (
                            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-sauti-orange/5 border-sauti-orange/20 animate-in fade-in slide-in-from-top-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase text-sauti-orange">Event Date</label>
                                    <Input 
                                        type="datetime-local" 
                                        value={formData.event_details.event_date ? new Date(formData.event_details.event_date).toISOString().slice(0, 16) : ""}
                                        onChange={(e) => updateEventDetail('event_date', new Date(e.target.value).toISOString())}
                                    />
                                </div>
                                <div className="space-y-2">
                                     <label className="text-xs font-semibold uppercase text-sauti-orange">Location</label>
                                     <div className="flex items-center gap-2">
                                        <Input 
                                            placeholder="Address or Link"
                                            value={formData.event_details.location}
                                            onChange={(e) => updateEventDetail('location', e.target.value)}
                                        />
                                     </div>
                                </div>
                                <div className="col-span-2 flex items-center space-x-2">
                                    <Checkbox 
                                        id="is_virtual"
                                        checked={formData.event_details.is_virtual}
                                        onCheckedChange={(checked) => updateEventDetail('is_virtual', !!checked)}
                                    />
                                    <label htmlFor="is_virtual" className="text-sm">Virtual Event (Online)</label>
                                </div>
                                {formData.event_details.is_virtual && (
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-xs font-semibold uppercase text-sauti-orange">Meeting Link</label>
                                        <Input 
                                            placeholder="https://zoom.us/..."
                                            value={formData.event_details.meeting_link || ""}
                                            onChange={(e) => updateEventDetail('meeting_link', e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Content</label>
                            <Textarea 
                                className="min-h-[200px]"
                                value={formData.content}
                                onChange={(e) => setFormData(prev => ({...prev, content: e.target.value}))}
                                placeholder="Write your content here..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status</label>
                            <Select 
                                value={formData.status} 
                                onValueChange={(val: any) => setFormData(prev => ({...prev, status: val}))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="pending_review">Pending Review</SelectItem>
                                    <SelectItem value="published">Published</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save Content"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
