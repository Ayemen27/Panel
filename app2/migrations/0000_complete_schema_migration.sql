CREATE TABLE "account_balances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" varchar NOT NULL,
	"project_id" varchar,
	"period" text NOT NULL,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"debit_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"credit_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"closing_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"parent_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"owner_id" varchar NOT NULL,
	"assigned_to" varchar,
	"related_object_type" text,
	"related_object_id" varchar,
	"status" text DEFAULT 'open' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"estimated_cost" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"due_date" date,
	"started_at" timestamp,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_type" text NOT NULL,
	"object_id" varchar NOT NULL,
	"requested_by" varchar NOT NULL,
	"approver_id" varchar,
	"current_level" integer DEFAULT 1 NOT NULL,
	"total_levels" integer DEFAULT 1 NOT NULL,
	"amount" numeric(12, 2),
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"due_date" timestamp,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autocomplete_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"value" text NOT NULL,
	"usage_count" integer DEFAULT 1 NOT NULL,
	"last_used" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'approval' NOT NULL,
	"related_object_type" text,
	"related_object_id" varchar,
	"participant_ids" jsonb NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_by" varchar NOT NULL,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_expense_summaries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"date" text NOT NULL,
	"carried_forward_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_fund_transfers" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_worker_wages" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_material_costs" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_transportation_costs" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_income" numeric(10, 2) NOT NULL,
	"total_expenses" numeric(10, 2) NOT NULL,
	"remaining_balance" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"event_type" text NOT NULL,
	"object_type" text,
	"object_id" varchar,
	"payload" jsonb,
	"metadata" jsonb,
	"triggered_by" varchar,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" varchar,
	"payment_number" text,
	"payment_type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"from_account" varchar,
	"to_account" varchar,
	"bank_reference" text,
	"check_number" text,
	"due_date" date,
	"paid_date" date,
	"payer_id" varchar,
	"payee_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_payments_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "fund_transfers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"sender_name" text,
	"transfer_number" text,
	"transfer_type" text NOT NULL,
	"transfer_date" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fund_transfers_transfer_number_unique" UNIQUE("transfer_number")
);
--> statement-breakpoint
CREATE TABLE "journals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" varchar NOT NULL,
	"journal_number" text,
	"period" text NOT NULL,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"reversal_journal_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"posted_at" timestamp,
	CONSTRAINT "journals_journal_number_unique" UNIQUE("journal_number")
);
--> statement-breakpoint
CREATE TABLE "maintenance_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" varchar NOT NULL,
	"schedule_type" text NOT NULL,
	"interval_days" integer,
	"interval_weeks" integer,
	"interval_months" integer,
	"usage_hours_interval" numeric(10, 2),
	"usage_count_interval" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_maintenance_date" timestamp,
	"next_due_date" timestamp NOT NULL,
	"maintenance_type" text DEFAULT 'preventive' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"estimated_duration" integer,
	"estimated_cost" numeric(12, 2),
	"assigned_to" varchar,
	"created_by" varchar,
	"title" text NOT NULL,
	"description" text,
	"checklist_items" jsonb,
	"enable_notifications" boolean DEFAULT true NOT NULL,
	"notify_days_before" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" varchar NOT NULL,
	"tool_id" varchar NOT NULL,
	"task_name" text NOT NULL,
	"task_description" text,
	"task_type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" timestamp NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"estimated_duration" integer,
	"actual_duration" integer,
	"estimated_cost" numeric(12, 2),
	"actual_cost" numeric(12, 2),
	"assigned_to" varchar,
	"performed_by" varchar,
	"result" text,
	"findings" text,
	"actions_taken" text,
	"recommendations" text,
	"before_images" text[],
	"after_images" text[],
	"document_urls" text[],
	"materials_used" jsonb,
	"performer_signature" text,
	"supervisor_signature" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"notes" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_purchases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"supplier_id" varchar,
	"material_id" varchar NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"purchase_type" text DEFAULT 'نقد' NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"remaining_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"supplier_name" text,
	"invoice_number" text,
	"invoice_date" text NOT NULL,
	"due_date" text,
	"invoice_photo" text,
	"notes" text,
	"purchase_date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"attachments" jsonb,
	"related_object_type" text,
	"related_object_id" varchar,
	"is_decision" boolean DEFAULT false NOT NULL,
	"decision_type" text,
	"is_edited" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_read_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" text NOT NULL,
	"user_id" varchar,
	"is_read" boolean DEFAULT true NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	"device_info" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_type" text DEFAULT 'worker_statement' NOT NULL,
	"name" text NOT NULL,
	"page_size" text DEFAULT 'A4' NOT NULL,
	"page_orientation" text DEFAULT 'portrait' NOT NULL,
	"margin_top" numeric(5, 2) DEFAULT '15.00' NOT NULL,
	"margin_bottom" numeric(5, 2) DEFAULT '15.00' NOT NULL,
	"margin_left" numeric(5, 2) DEFAULT '15.00' NOT NULL,
	"margin_right" numeric(5, 2) DEFAULT '15.00' NOT NULL,
	"font_family" text DEFAULT 'Arial' NOT NULL,
	"font_size" integer DEFAULT 12 NOT NULL,
	"header_font_size" integer DEFAULT 16 NOT NULL,
	"table_font_size" integer DEFAULT 10 NOT NULL,
	"header_background_color" text DEFAULT '#1e40af' NOT NULL,
	"header_text_color" text DEFAULT '#ffffff' NOT NULL,
	"table_header_color" text DEFAULT '#1e40af' NOT NULL,
	"table_row_even_color" text DEFAULT '#ffffff' NOT NULL,
	"table_row_odd_color" text DEFAULT '#f9fafb' NOT NULL,
	"table_border_color" text DEFAULT '#000000' NOT NULL,
	"table_border_width" integer DEFAULT 1 NOT NULL,
	"table_cell_padding" integer DEFAULT 3 NOT NULL,
	"table_column_widths" text DEFAULT '[8,12,10,30,12,15,15,12]' NOT NULL,
	"show_header" boolean DEFAULT true NOT NULL,
	"show_logo" boolean DEFAULT true NOT NULL,
	"show_project_info" boolean DEFAULT true NOT NULL,
	"show_worker_info" boolean DEFAULT true NOT NULL,
	"show_attendance_table" boolean DEFAULT true NOT NULL,
	"show_transfers_table" boolean DEFAULT true NOT NULL,
	"show_summary" boolean DEFAULT true NOT NULL,
	"show_signatures" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_fund_transfers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_project_id" varchar NOT NULL,
	"to_project_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text,
	"transfer_reason" text,
	"transfer_date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_name" text DEFAULT 'default' NOT NULL,
	"header_title" text DEFAULT 'نظام إدارة مشاريع البناء' NOT NULL,
	"header_subtitle" text DEFAULT 'تقرير مالي',
	"company_name" text DEFAULT 'شركة البناء والتطوير' NOT NULL,
	"company_address" text DEFAULT 'صنعاء - اليمن',
	"company_phone" text DEFAULT '+967 1 234567',
	"company_email" text DEFAULT 'info@company.com',
	"footer_text" text DEFAULT 'تم إنشاء هذا التقرير بواسطة نظام إدارة المشاريع',
	"footer_contact" text DEFAULT 'للاستفسار: info@company.com | +967 1 234567',
	"primary_color" text DEFAULT '#1f2937' NOT NULL,
	"secondary_color" text DEFAULT '#3b82f6' NOT NULL,
	"accent_color" text DEFAULT '#10b981' NOT NULL,
	"text_color" text DEFAULT '#1f2937' NOT NULL,
	"background_color" text DEFAULT '#ffffff' NOT NULL,
	"font_size" integer DEFAULT 11 NOT NULL,
	"font_family" text DEFAULT 'Arial' NOT NULL,
	"logo_url" text,
	"page_orientation" text DEFAULT 'portrait' NOT NULL,
	"page_size" text DEFAULT 'A4' NOT NULL,
	"margins" jsonb DEFAULT '{"top":1,"bottom":1,"left":0.75,"right":0.75}'::jsonb,
	"show_header" boolean DEFAULT true NOT NULL,
	"show_footer" boolean DEFAULT true NOT NULL,
	"show_logo" boolean DEFAULT true NOT NULL,
	"show_date" boolean DEFAULT true NOT NULL,
	"show_page_numbers" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"purchase_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" text DEFAULT 'نقد' NOT NULL,
	"payment_date" text NOT NULL,
	"reference_number" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"address" text,
	"payment_terms" text DEFAULT 'نقد',
	"total_debt" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "system_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" varchar NOT NULL,
	"user_id" varchar,
	"event_data" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source_type" text,
	"source_id" varchar,
	"source_name" text,
	"user_id" varchar,
	"target_audience" text DEFAULT 'all',
	"action_required" boolean DEFAULT false NOT NULL,
	"action_url" text,
	"action_label" text,
	"scheduled_for" timestamp,
	"expires_at" timestamp,
	"read_at" timestamp,
	"dismissed_at" timestamp,
	"metadata" jsonb,
	"attachments" text[],
	"view_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_auto_generated" boolean DEFAULT true NOT NULL,
	"is_persistent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text DEFAULT '#3b82f6',
	"parent_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tool_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tool_cost_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" varchar NOT NULL,
	"cost_type" text NOT NULL,
	"cost_category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'YER' NOT NULL,
	"cost_date" text NOT NULL,
	"cost_period" text,
	"reference_type" text,
	"reference_id" varchar,
	"description" text NOT NULL,
	"notes" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"project_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_maintenance_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" varchar NOT NULL,
	"maintenance_type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"work_performed" text,
	"scheduled_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"next_due_date" timestamp,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"labor_cost" numeric(12, 2) DEFAULT '0',
	"parts_cost" numeric(12, 2) DEFAULT '0',
	"total_cost" numeric(12, 2) DEFAULT '0',
	"performed_by" varchar,
	"assigned_to" varchar,
	"condition_before" text,
	"condition_after" text,
	"image_urls" text[],
	"document_urls" text[],
	"notes" text,
	"issues" text,
	"recommendations" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_movements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" varchar NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"from_type" text,
	"from_id" varchar,
	"to_type" text,
	"to_id" varchar,
	"project_id" varchar,
	"reason" text,
	"notes" text,
	"reference_number" text,
	"performed_by" text NOT NULL,
	"performed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"tool_id" varchar,
	"tool_name" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"action_required" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tool_purchase_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_purchase_id" varchar NOT NULL,
	"item_name" text NOT NULL,
	"item_description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"is_tool_item" boolean DEFAULT false NOT NULL,
	"suggested_category_id" varchar,
	"conversion_status" text DEFAULT 'pending' NOT NULL,
	"tool_id" varchar,
	"ai_confidence" numeric(5, 2),
	"ai_suggestions" jsonb,
	"notes" text,
	"converted_at" timestamp,
	"converted_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_reservations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"reserved_by" varchar NOT NULL,
	"reservation_date" timestamp DEFAULT now() NOT NULL,
	"requested_date" timestamp NOT NULL,
	"expiry_date" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"reason" text,
	"notes" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"fulfilled_by" varchar,
	"fulfilled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_stock" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" varchar NOT NULL,
	"location_type" text NOT NULL,
	"location_id" varchar,
	"location_name" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"available_quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"last_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_usage_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" varchar NOT NULL,
	"project_id" varchar,
	"analysis_date" text NOT NULL,
	"analysis_week" text,
	"analysis_month" text,
	"usage_hours" numeric(10, 2) DEFAULT '0',
	"transfer_count" integer DEFAULT 0,
	"maintenance_count" integer DEFAULT 0,
	"operational_cost" numeric(12, 2) DEFAULT '0',
	"maintenance_cost" numeric(12, 2) DEFAULT '0',
	"utilization_rate" numeric(5, 2),
	"efficiency_score" numeric(5, 2),
	"predicted_usage" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"category_id" varchar,
	"project_id" varchar,
	"unit" text DEFAULT 'قطعة' NOT NULL,
	"is_tool" boolean DEFAULT true NOT NULL,
	"is_consumable" boolean DEFAULT false NOT NULL,
	"is_serial" boolean DEFAULT false NOT NULL,
	"purchase_price" numeric(12, 2),
	"current_value" numeric(12, 2),
	"depreciation_rate" numeric(5, 2),
	"purchase_date" date,
	"supplier_id" varchar,
	"warranty_expiry" date,
	"maintenance_interval" integer,
	"last_maintenance_date" date,
	"next_maintenance_date" date,
	"status" text DEFAULT 'available' NOT NULL,
	"condition" text DEFAULT 'excellent' NOT NULL,
	"location_type" text,
	"location_id" text,
	"serial_number" text,
	"barcode" text,
	"qr_code" text,
	"image_urls" text[],
	"notes" text,
	"specifications" jsonb,
	"total_usage_hours" numeric(10, 2) DEFAULT '0',
	"usage_count" integer DEFAULT 0,
	"ai_rating" numeric(3, 2),
	"ai_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tools_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "transaction_lines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"debit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"cost_center" text,
	"project_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_number" text,
	"date" date NOT NULL,
	"description" text,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"transaction_type" text NOT NULL,
	"project_id" varchar,
	"related_object_type" text,
	"related_object_id" varchar,
	"created_by" varchar,
	"approved_by" varchar,
	"posted_by" varchar,
	"approved_at" timestamp,
	"posted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportation_expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"worker_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"description" text NOT NULL,
	"date" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" text DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "worker_attendance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"worker_id" varchar NOT NULL,
	"date" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"work_description" text,
	"is_present" boolean NOT NULL,
	"work_days" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"daily_wage" numeric(10, 2) NOT NULL,
	"actual_wage" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"remaining_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payment_type" text DEFAULT 'partial' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_balances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"total_earned" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_transferred" numeric(10, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_misc_expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text NOT NULL,
	"date" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_transfers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"transfer_number" text,
	"sender_name" text,
	"recipient_name" text NOT NULL,
	"recipient_phone" text,
	"transfer_method" text NOT NULL,
	"transfer_date" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"usage_count" integer DEFAULT 1 NOT NULL,
	"last_used" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "worker_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"daily_wage" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_expense_summaries" ADD CONSTRAINT "daily_expense_summaries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_payments" ADD CONSTRAINT "finance_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_payments" ADD CONSTRAINT "finance_payments_from_account_accounts_id_fk" FOREIGN KEY ("from_account") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_payments" ADD CONSTRAINT "finance_payments_to_account_accounts_id_fk" FOREIGN KEY ("to_account") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_schedule_id_maintenance_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."maintenance_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_read_states" ADD CONSTRAINT "notification_read_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_fund_transfers" ADD CONSTRAINT "project_fund_transfers_from_project_id_projects_id_fk" FOREIGN KEY ("from_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_fund_transfers" ADD CONSTRAINT "project_fund_transfers_to_project_id_projects_id_fk" FOREIGN KEY ("to_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchase_id_material_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."material_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_notifications" ADD CONSTRAINT "system_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_categories" ADD CONSTRAINT "tool_categories_parent_id_tool_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tool_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_cost_tracking" ADD CONSTRAINT "tool_cost_tracking_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_cost_tracking" ADD CONSTRAINT "tool_cost_tracking_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_cost_tracking" ADD CONSTRAINT "tool_cost_tracking_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_maintenance_logs" ADD CONSTRAINT "tool_maintenance_logs_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_maintenance_logs" ADD CONSTRAINT "tool_maintenance_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_maintenance_logs" ADD CONSTRAINT "tool_maintenance_logs_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_movements" ADD CONSTRAINT "tool_movements_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_movements" ADD CONSTRAINT "tool_movements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_notifications" ADD CONSTRAINT "tool_notifications_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_purchase_items" ADD CONSTRAINT "tool_purchase_items_material_purchase_id_material_purchases_id_fk" FOREIGN KEY ("material_purchase_id") REFERENCES "public"."material_purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_purchase_items" ADD CONSTRAINT "tool_purchase_items_suggested_category_id_tool_categories_id_fk" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."tool_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_purchase_items" ADD CONSTRAINT "tool_purchase_items_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_purchase_items" ADD CONSTRAINT "tool_purchase_items_converted_by_users_id_fk" FOREIGN KEY ("converted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_reservations" ADD CONSTRAINT "tool_reservations_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_reservations" ADD CONSTRAINT "tool_reservations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_reservations" ADD CONSTRAINT "tool_reservations_reserved_by_users_id_fk" FOREIGN KEY ("reserved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_reservations" ADD CONSTRAINT "tool_reservations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_reservations" ADD CONSTRAINT "tool_reservations_fulfilled_by_users_id_fk" FOREIGN KEY ("fulfilled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_stock" ADD CONSTRAINT "tool_stock_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_usage_analytics" ADD CONSTRAINT "tool_usage_analytics_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_usage_analytics" ADD CONSTRAINT "tool_usage_analytics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_category_id_tool_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tool_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportation_expenses" ADD CONSTRAINT "transportation_expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportation_expenses" ADD CONSTRAINT "transportation_expenses_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_attendance" ADD CONSTRAINT "worker_attendance_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_attendance" ADD CONSTRAINT "worker_attendance_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_balances" ADD CONSTRAINT "worker_balances_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_balances" ADD CONSTRAINT "worker_balances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_misc_expenses" ADD CONSTRAINT "worker_misc_expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_transfers" ADD CONSTRAINT "worker_transfers_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_transfers" ADD CONSTRAINT "worker_transfers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;