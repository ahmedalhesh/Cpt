/**
 * Database storage implementation for Cloudflare D1
 * Adapted from server/storage.ts
 */

import {
	users,
	reports,
	comments,
	attachments,
	companySettings,
	notifications,
	type User,
	type UpsertUser,
	type Report,
	type InsertReport,
	type Comment,
	type InsertComment,
	type Attachment,
	type InsertAttachment,
	type ReportStats,
	type CompanySettings,
	type UpsertCompanySettings,
	type Notification,
	type UpsertNotification,
} from "@shared/schema";
import { getDB } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import type { D1Database } from '@cloudflare/workers-types';

export interface IStorage {
	// User operations
	getUser(id: string): Promise<User | undefined>;
	getUserByEmail(email: string): Promise<User | undefined>;
	getUserByName(firstName: string, lastName: string): Promise<User | undefined>;
	createUser(user: UpsertUser): Promise<User>;
	upsertUser(user: UpsertUser): Promise<User>;
	updateUserPassword(id: string, password: string): Promise<void>;
	
	// Report operations
	createReport(report: InsertReport): Promise<Report>;
	getReport(id: string): Promise<(Report & { submitter: User; comments: (Comment & { user: User })[]; }) | undefined>;
	getAllReports(filters?: { type?: string; status?: string }): Promise<(Report & { submitter: User })[]>;
	getUserReports(userId: string, filters?: { type?: string; status?: string }): Promise<(Report & { submitter: User })[]>;
	updateReportStatus(id: string, status: string): Promise<Report | undefined>;
	getReportStats(): Promise<ReportStats>;
	getUserReportStats(userId: string): Promise<ReportStats>;
	
	// Comment operations
	createComment(comment: InsertComment): Promise<Comment>;
	getCommentsByReportId(reportId: string): Promise<(Comment & { user: User })[]>;
	
	// Attachment operations
	createAttachment(attachment: InsertAttachment): Promise<Attachment>;
	getAttachment(id: string): Promise<Attachment | undefined>;
	getAttachmentsByReportId(reportId: string): Promise<Attachment[]>;
}

export class D1Storage implements IStorage {
	private db: ReturnType<typeof getDB>;

	constructor(d1: D1Database) {
		this.db = getDB(d1);
	}

	// User operations
	async getUser(id: string): Promise<User | undefined> {
		const [user] = await this.db.select().from(users).where(eq(users.id, id));
		return user;
	}

	async getUserByEmail(email: string): Promise<User | undefined> {
		const [user] = await this.db.select().from(users).where(eq(users.email, email));
		return user;
	}

	async getUserByName(firstName: string, lastName: string): Promise<User | undefined> {
		const [user] = await this.db.select().from(users).where(
			and(
				eq(users.firstName, firstName),
				eq(users.lastName, lastName)
			)
		);
		return user;
	}

	async createUser(userData: UpsertUser): Promise<User> {
		const [user] = await this.db
			.insert(users)
			.values(userData)
			.returning();
		return user;
	}

	async upsertUser(userData: UpsertUser): Promise<User> {
		const [user] = await this.db
			.insert(users)
			.values(userData)
			.onConflictDoUpdate({
				target: users.id,
				set: {
					...userData,
					updatedAt: new Date().toISOString(),
				},
			})
			.returning();
		return user;
	}

	async getAllUsers(): Promise<User[]> {
		return await this.db.select().from(users);
	}

	async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
		const [user] = await this.db
			.update(users)
			.set({ ...userData, updatedAt: new Date().toISOString() })
			.where(eq(users.id, id))
			.returning();
		return user;
	}

	async deleteUser(id: string): Promise<void> {
		await this.db.delete(users).where(eq(users.id, id));
	}

	async updateUserPassword(id: string, password: string): Promise<void> {
		await this.db
			.update(users)
			.set({ password, updatedAt: new Date().toISOString() })
			.where(eq(users.id, id));
	}

	// Company Settings operations
	async getCompanySettings(): Promise<CompanySettings | null> {
		const [settings] = await this.db.select().from(companySettings).limit(1);
		return settings || null;
	}

	async updateCompanySettings(data: Partial<UpsertCompanySettings>): Promise<CompanySettings> {
		const existing = await this.getCompanySettings();
		
		if (existing) {
			const [updated] = await this.db
				.update(companySettings)
				.set({ ...data, updatedAt: new Date().toISOString() })
				.where(eq(companySettings.id, existing.id))
				.returning();
			return updated;
		} else {
			const [created] = await this.db
				.insert(companySettings)
				.values({
					...data,
					updatedAt: new Date().toISOString(),
				})
				.returning();
			return created;
		}
	}

	async deleteCompanyLogo(): Promise<void> {
		const existing = await this.getCompanySettings();
		if (existing) {
			await this.db
				.update(companySettings)
				.set({ logo: null, updatedAt: new Date().toISOString() })
				.where(eq(companySettings.id, existing.id));
		}
	}

	// Report operations - Continue with simplified version
	// Full implementation will be added incrementally
	async createReport(reportData: InsertReport): Promise<Report> {
		const [report] = await this.db
			.insert(reports)
			.values(reportData)
			.returning();
		return report;
	}

	async getReport(id: string): Promise<(Report & { submitter: User; comments: (Comment & { user: User })[]; }) | undefined> {
		const [report] = await this.db
			.select()
			.from(reports)
			.where(eq(reports.id, id));

		if (!report) {
			return undefined;
		}

		const [submitter] = await this.db
			.select()
			.from(users)
			.where(eq(users.id, report.submittedBy));

		const reportComments = await this.db
			.select({
				comment: comments,
				user: users,
			})
			.from(comments)
			.leftJoin(users, eq(comments.userId, users.id))
			.where(eq(comments.reportId, id))
			.orderBy(comments.createdAt);

		// Parse extraData from JSON string to object if it exists
		let parsedExtraData = null;
		if (report.extraData && typeof report.extraData === 'string') {
			try {
				parsedExtraData = JSON.parse(report.extraData);
			} catch (e) {
				console.error('Error parsing extraData:', e);
			}
		} else {
			parsedExtraData = report.extraData;
		}

		return {
			...report,
			extraData: parsedExtraData,
			submitter: submitter || {} as User,
			comments: reportComments.map((rc: any) => ({
				...rc.comment,
				user: rc.user || {} as User,
			})),
		};
	}

	async getAllReports(filters?: { type?: string; status?: string }): Promise<(Report & { submitter: User })[]> {
		let query = this.db
			.select({
				report: reports,
				submitter: users,
			})
			.from(reports)
			.leftJoin(users, eq(reports.submittedBy, users.id))
			.orderBy(desc(reports.createdAt));

		const conditions = [];
		if (filters?.type) {
			conditions.push(eq(reports.reportType, filters.type));
		}
		if (filters?.status) {
			conditions.push(eq(reports.status, filters.status));
		}

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as any;
		}

		const results = await query;
		
		// Parse extraData for each report
		return results.map((r: any) => {
			let parsedExtraData = null;
			if (r.report.extraData && typeof r.report.extraData === 'string') {
				try {
					parsedExtraData = JSON.parse(r.report.extraData);
				} catch (e) {
					console.error('Error parsing extraData:', e);
				}
			} else {
				parsedExtraData = r.report.extraData;
			}

			return {
				...r.report,
				extraData: parsedExtraData,
				submitter: r.submitter || {} as User,
			};
		});
	}

	async getUserReports(userId: string, filters?: { type?: string; status?: string }): Promise<(Report & { submitter: User })[]> {
		let query = this.db
			.select({
				report: reports,
				submitter: users,
			})
			.from(reports)
			.leftJoin(users, eq(reports.submittedBy, users.id))
			.where(eq(reports.submittedBy, userId))
			.orderBy(desc(reports.createdAt));

		const conditions = [eq(reports.submittedBy, userId)];
		if (filters?.type) {
			conditions.push(eq(reports.reportType, filters.type));
		}
		if (filters?.status) {
			conditions.push(eq(reports.status, filters.status));
		}

		query = query.where(and(...conditions)) as any;

		const results = await query;
		
		return results.map((r: any) => {
			let parsedExtraData = null;
			if (r.report.extraData && typeof r.report.extraData === 'string') {
				try {
					parsedExtraData = JSON.parse(r.report.extraData);
				} catch (e) {
					console.error('Error parsing extraData:', e);
				}
			} else {
				parsedExtraData = r.report.extraData;
			}

			return {
				...r.report,
				extraData: parsedExtraData,
				submitter: r.submitter || {} as User,
			};
		});
	}

	async updateReportStatus(id: string, status: string): Promise<Report | undefined> {
		const [report] = await this.db
			.update(reports)
			.set({ status, updatedAt: new Date().toISOString() })
			.where(eq(reports.id, id))
			.returning();
		return report;
	}

	async getReportStats(): Promise<ReportStats> {
		const allReports = await this.db.select().from(reports);
		
		return {
			total: allReports.length,
			submitted: allReports.filter(r => r.status === 'submitted').length,
			inReview: allReports.filter(r => r.status === 'in_review').length,
			approved: allReports.filter(r => r.status === 'approved').length,
			rejected: allReports.filter(r => r.status === 'rejected').length,
			closed: allReports.filter(r => r.status === 'closed').length,
		};
	}

	async getUserReportStats(userId: string): Promise<ReportStats> {
		const userReports = await this.db
			.select()
			.from(reports)
			.where(eq(reports.submittedBy, userId));
		
		return {
			total: userReports.length,
			submitted: userReports.filter(r => r.status === 'submitted').length,
			inReview: userReports.filter(r => r.status === 'in_review').length,
			approved: userReports.filter(r => r.status === 'approved').length,
			rejected: userReports.filter(r => r.status === 'rejected').length,
			closed: userReports.filter(r => r.status === 'closed').length,
		};
	}

	// Comment operations
	async createComment(commentData: InsertComment): Promise<Comment> {
		const [comment] = await this.db
			.insert(comments)
			.values(commentData)
			.returning();
		return comment;
	}

	async getCommentsByReportId(reportId: string): Promise<(Comment & { user: User })[]> {
		const results = await this.db
			.select({
				comment: comments,
				user: users,
			})
			.from(comments)
			.leftJoin(users, eq(comments.userId, users.id))
			.where(eq(comments.reportId, reportId))
			.orderBy(comments.createdAt);
		
		return results.map((r: any) => ({
			...r.comment,
			user: r.user || {} as User,
		}));
	}

	// Attachment operations - Simplified for D1
	async createAttachment(attachmentData: InsertAttachment): Promise<Attachment> {
		const [attachment] = await this.db
			.insert(attachments)
			.values(attachmentData)
			.returning();
		return attachment;
	}

	async getAttachment(id: string): Promise<Attachment | undefined> {
		const [attachment] = await this.db.select().from(attachments).where(eq(attachments.id, id));
		return attachment;
	}

	async getAttachmentsByReportId(reportId: string): Promise<Attachment[]> {
		return await this.db
			.select()
			.from(attachments)
			.where(eq(attachments.reportId, reportId));
	}

	// Notification operations (needed for routes)
	async getNotifications(userId: string): Promise<Notification[]> {
		const results = await this.db
			.select()
			.from(notifications)
			.where(eq(notifications.userId, userId))
			.orderBy(desc(notifications.createdAt));
		
		return results.map((n: any) => ({
			...n,
			isRead: n.isRead === 1,
		})) as Notification[];
	}

	async getUnreadNotificationCount(userId: string): Promise<number> {
		const results = await this.db
			.select()
			.from(notifications)
			.where(and(
				eq(notifications.userId, userId),
				eq(notifications.isRead, 0)
			));
		return results.length;
	}

	async markNotificationAsRead(id: string): Promise<Notification> {
		const [notification] = await this.db
			.update(notifications)
			.set({ isRead: 1, updatedAt: new Date().toISOString() })
			.where(eq(notifications.id, id))
			.returning();
		
		const notificationWithBool = notification as any;
		return {
			...notificationWithBool,
			isRead: notificationWithBool.isRead === 1,
		} as Notification;
	}

	async markAllNotificationsAsRead(userId: string): Promise<void> {
		await this.db
			.update(notifications)
			.set({ isRead: 1, updatedAt: new Date().toISOString() })
			.where(eq(notifications.userId, userId));
	}

	async createNotification(notificationData: UpsertNotification): Promise<Notification> {
		const [notification] = await this.db
			.insert(notifications)
			.values(notificationData)
			.returning();
		
		const notificationWithBool = notification as any;
		return {
			...notificationWithBool,
			isRead: notificationWithBool.isRead === 1,
		} as Notification;
	}

	async deleteNotification(id: string): Promise<void> {
		await this.db.delete(notifications).where(eq(notifications.id, id));
	}

	async deleteAllNotifications(userId: string): Promise<void> {
		await this.db.delete(notifications).where(eq(notifications.userId, userId));
	}

	// Notification creation helpers (simplified versions)
	async createReportSubmittedNotification(reportId: string, submittedBy: string): Promise<void> {
		// Get all admin users
		const adminUsers = await this.db
			.select()
			.from(users)
			.where(eq(users.role, 'admin'));

		// Create notifications for all admins
		for (const admin of adminUsers) {
			await this.db.insert(notifications).values({
				userId: admin.id,
				title: 'New Report Submitted',
				message: `A new report has been submitted and requires your review.`,
				type: 'info',
				relatedReportId: reportId,
				isRead: 0,
			});
		}
	}

	async createReportStatusUpdatedNotification(reportId: string, userId: string, status: string): Promise<void> {
		const statusMessages: Record<string, string> = {
			approved: 'Your report has been approved.',
			rejected: 'Your report has been rejected.',
			in_review: 'Your report is now under review.',
			closed: 'Your report has been closed.',
		};

		await this.db.insert(notifications).values({
			userId,
			title: 'Report Status Updated',
			message: statusMessages[status] || `Your report status has been updated to ${status}.`,
			type: status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'info',
			relatedReportId: reportId,
			isRead: 0,
		});
	}

	async createCommentAddedNotification(reportId: string, commenterId: string, commentText: string): Promise<void> {
		// Get report submitter
		const [report] = await this.db.select().from(reports).where(eq(reports.id, reportId));
		if (!report) return;

		const [commenter] = await this.db.select().from(users).where(eq(users.id, commenterId));
		
		// Don't notify if commenter is the submitter
		if (report.submittedBy === commenterId) return;

		await this.db.insert(notifications).values({
			userId: report.submittedBy,
			title: 'New Comment on Your Report',
			message: `${commenter?.firstName || commenter?.email || 'Someone'} added a comment on your report.`,
			type: 'info',
			relatedReportId: reportId,
			isRead: 0,
		});
	}
}

