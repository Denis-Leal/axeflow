--
-- PostgreSQL database dump
--

\restrict cBzsW1d3ZxPszuLFUmo7UdM5sJsTzN68CX2CaLE3hlkPZTcR5wirGTu50YZATLP

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg12+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: terreiro
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO terreiro;

--
-- Name: acessogiraenum; Type: TYPE; Schema: public; Owner: terreiro
--

CREATE TYPE public.acessogiraenum AS ENUM (
    'publica',
    'fechada'
);


ALTER TYPE public.acessogiraenum OWNER TO terreiro;

--
-- Name: roleenum; Type: TYPE; Schema: public; Owner: terreiro
--

CREATE TYPE public.roleenum AS ENUM (
    'admin',
    'operador',
    'membro'
);


ALTER TYPE public.roleenum OWNER TO terreiro;

--
-- Name: statusgiraenum; Type: TYPE; Schema: public; Owner: terreiro
--

CREATE TYPE public.statusgiraenum AS ENUM (
    'aberta',
    'fechada',
    'concluida'
);


ALTER TYPE public.statusgiraenum OWNER TO terreiro;

--
-- Name: statusinscricaoenum; Type: TYPE; Schema: public; Owner: terreiro
--

CREATE TYPE public.statusinscricaoenum AS ENUM (
    'confirmado',
    'compareceu',
    'faltou',
    'cancelado',
    'lista_espera'
);


ALTER TYPE public.statusinscricaoenum OWNER TO terreiro;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _migration_baseline; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public._migration_baseline (
    capturado_em timestamp with time zone,
    ig_consulentes bigint,
    ig_membros bigint,
    ic_total bigint,
    im_total bigint,
    ig_confirmados bigint,
    ig_fila bigint,
    ig_compareceu bigint,
    ig_faltou bigint
);


ALTER TABLE public._migration_baseline OWNER TO terreiro;

--
-- Name: ajeum; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.ajeum (
    id uuid NOT NULL,
    terreiro_id uuid NOT NULL,
    gira_id uuid NOT NULL,
    criado_por uuid NOT NULL,
    observacoes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.ajeum OWNER TO terreiro;

--
-- Name: ajeum_item; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.ajeum_item (
    id uuid NOT NULL,
    terreiro_id uuid NOT NULL,
    ajeum_id uuid NOT NULL,
    descricao character varying(255) NOT NULL,
    limite integer NOT NULL,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT ck_ajeum_item_limite_positivo CHECK ((limite >= 1))
);


ALTER TABLE public.ajeum_item OWNER TO terreiro;

--
-- Name: ajeum_selecao; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.ajeum_selecao (
    id uuid NOT NULL,
    terreiro_id uuid NOT NULL,
    item_id uuid NOT NULL,
    membro_id uuid NOT NULL,
    status character varying(50) DEFAULT 'selecionado'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    confirmado_por uuid,
    confirmado_em timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT ck_ajeum_selecao_confirmacao_consistente CHECK ((((status)::text <> ALL ((ARRAY['confirmado'::character varying, 'nao_entregue'::character varying])::text[])) OR ((confirmado_por IS NOT NULL) AND (confirmado_em IS NOT NULL)))),
    CONSTRAINT ck_ajeum_selecao_status CHECK (((status)::text = ANY ((ARRAY['selecionado'::character varying, 'confirmado'::character varying, 'nao_entregue'::character varying, 'cancelado'::character varying])::text[])))
);


ALTER TABLE public.ajeum_selecao OWNER TO terreiro;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.alembic_version (
    version_num character varying(64) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO terreiro;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.api_keys (
    id uuid NOT NULL,
    terreiro_id uuid NOT NULL,
    user_id uuid NOT NULL,
    prefix character varying(10) NOT NULL,
    key_hash character varying(64) NOT NULL,
    nome character varying(100) NOT NULL,
    descricao text,
    scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    ativa boolean DEFAULT true NOT NULL,
    expires_at timestamp without time zone,
    last_used_at timestamp without time zone,
    request_count bigint DEFAULT '0'::bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    revoked_at timestamp without time zone
);


ALTER TABLE public.api_keys OWNER TO terreiro;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    context character varying(100) NOT NULL,
    status integer,
    code character varying(50),
    message text,
    url text,
    method character varying(10),
    user_agent text,
    created_at timestamp without time zone,
    user_id uuid,
    ip character varying(45),
    level character varying(10) DEFAULT 'INFO'::character varying NOT NULL,
    action character varying(100),
    trace_id character varying(36)
);


ALTER TABLE public.audit_logs OWNER TO terreiro;

--
-- Name: consulentes; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.consulentes (
    id uuid NOT NULL,
    nome character varying(255) NOT NULL,
    telefone character varying(20) NOT NULL,
    primeira_visita boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    notas text
);


ALTER TABLE public.consulentes OWNER TO terreiro;

--
-- Name: gira_item_consumptions; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.gira_item_consumptions (
    id uuid NOT NULL,
    terreiro_id uuid NOT NULL,
    gira_id uuid NOT NULL,
    medium_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    source character varying(20) NOT NULL,
    quantity integer NOT NULL,
    status character varying(20) DEFAULT 'PENDENTE'::character varying NOT NULL,
    movement_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT ck_consumption_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT ck_consumption_source CHECK (((source)::text = ANY ((ARRAY['MEDIUM'::character varying, 'TERREIRO'::character varying])::text[]))),
    CONSTRAINT ck_consumption_status CHECK (((status)::text = ANY ((ARRAY['PENDENTE'::character varying, 'PROCESSADO'::character varying, 'CANCELADO'::character varying])::text[])))
);


ALTER TABLE public.gira_item_consumptions OWNER TO terreiro;

--
-- Name: gira_notifications; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.gira_notifications (
    id uuid NOT NULL,
    gira_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    read_at timestamp without time zone,
    CONSTRAINT ck_notification_type CHECK (((type)::text = 'MISSING_CONSUMPTION'::text))
);


ALTER TABLE public.gira_notifications OWNER TO terreiro;

--
-- Name: giras; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.giras (
    id uuid NOT NULL,
    terreiro_id uuid NOT NULL,
    titulo character varying(255) NOT NULL,
    tipo character varying(100),
    data date NOT NULL,
    horario time without time zone NOT NULL,
    limite_consulentes integer,
    abertura_lista timestamp without time zone,
    fechamento_lista timestamp without time zone,
    responsavel_lista_id uuid,
    status public.statusgiraenum,
    slug_publico character varying(255),
    created_at timestamp without time zone,
    acesso character varying(20) DEFAULT 'publica'::character varying NOT NULL,
    deleted_at timestamp without time zone,
    updated_at timestamp without time zone,
    limite_membros integer,
    estoque_processado boolean DEFAULT false NOT NULL
);


ALTER TABLE public.giras OWNER TO terreiro;

--
-- Name: inscricoes_consulente; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.inscricoes_consulente (
    id uuid NOT NULL,
    gira_id uuid NOT NULL,
    consulente_id uuid NOT NULL,
    posicao integer NOT NULL,
    status character varying(50) DEFAULT 'confirmado'::character varying NOT NULL,
    observacoes text,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.inscricoes_consulente OWNER TO terreiro;

--
-- Name: inscricoes_gira; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.inscricoes_gira (
    id uuid NOT NULL,
    gira_id uuid NOT NULL,
    consulente_id uuid,
    posicao integer NOT NULL,
    status public.statusinscricaoenum,
    created_at timestamp without time zone,
    membro_id uuid,
    observacoes text,
    updated_at timestamp without time zone,
    CONSTRAINT ck_inscricao_exactly_one_participant CHECK ((((consulente_id IS NOT NULL) AND (membro_id IS NULL)) OR ((consulente_id IS NULL) AND (membro_id IS NOT NULL))))
);


ALTER TABLE public.inscricoes_gira OWNER TO terreiro;

--
-- Name: inscricoes_membro; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.inscricoes_membro (
    id uuid NOT NULL,
    gira_id uuid NOT NULL,
    membro_id uuid NOT NULL,
    posicao integer NOT NULL,
    status character varying(50) DEFAULT 'confirmado'::character varying NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone
);


ALTER TABLE public.inscricoes_membro OWNER TO terreiro;

--
-- Name: inventory_alerts; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.inventory_alerts (
    id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    triggered_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone,
    last_notified_at timestamp without time zone
);


ALTER TABLE public.inventory_alerts OWNER TO terreiro;

--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.inventory_items (
    id uuid NOT NULL,
    terreiro_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    minimum_threshold integer DEFAULT 0 NOT NULL,
    unit_cost numeric(10,2),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    deleted_at timestamp without time zone,
    CONSTRAINT ck_inventory_item_category CHECK (((category)::text = ANY ((ARRAY['bebida'::character varying, 'charuto'::character varying, 'cigarro'::character varying, 'cigarro_palha'::character varying, 'pemba'::character varying, 'vela'::character varying, 'outros'::character varying])::text[]))),
    CONSTRAINT ck_inventory_item_threshold_positive CHECK ((minimum_threshold >= 0))
);


ALTER TABLE public.inventory_items OWNER TO terreiro;

--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.inventory_movements (
    id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    quantity integer NOT NULL,
    gira_id uuid,
    created_by uuid NOT NULL,
    notes character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_movement_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT ck_movement_type CHECK (((type)::text = ANY ((ARRAY['IN'::character varying, 'OUT'::character varying, 'ADJUSTMENT'::character varying])::text[])))
);


ALTER TABLE public.inventory_movements OWNER TO terreiro;

--
-- Name: inventory_owners; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.inventory_owners (
    id uuid NOT NULL,
    type character varying(20) NOT NULL,
    reference_id uuid,
    CONSTRAINT ck_inventory_owner_type CHECK (((type)::text = ANY ((ARRAY['MEDIUM'::character varying, 'TERREIRO'::character varying])::text[])))
);


ALTER TABLE public.inventory_owners OWNER TO terreiro;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.password_reset_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    terreiro_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO terreiro;

--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.push_subscriptions (
    id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    user_id uuid,
    terreiro_id uuid
);


ALTER TABLE public.push_subscriptions OWNER TO terreiro;

--
-- Name: terreiros; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.terreiros (
    id uuid NOT NULL,
    nome character varying(255) NOT NULL,
    cidade character varying(255) NOT NULL,
    created_at timestamp without time zone
);


ALTER TABLE public.terreiros OWNER TO terreiro;

--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: terreiro
--

CREATE TABLE public.usuarios (
    id uuid NOT NULL,
    terreiro_id uuid NOT NULL,
    nome character varying(255) NOT NULL,
    telefone character varying(20),
    email character varying(255) NOT NULL,
    senha_hash character varying(255) NOT NULL,
    role public.roleenum,
    ativo boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.usuarios OWNER TO terreiro;

--
-- Data for Name: _migration_baseline; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public._migration_baseline (capturado_em, ig_consulentes, ig_membros, ic_total, im_total, ig_confirmados, ig_fila, ig_compareceu, ig_faltou) FROM stdin;
2026-03-21 18:09:26.832781+00	7	9	7	10	6	0	0	0
2026-03-21 18:16:34.134596+00	7	9	7	10	6	0	0	0
\.


--
-- Data for Name: ajeum; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.ajeum (id, terreiro_id, gira_id, criado_por, observacoes, created_at, updated_at) FROM stdin;
ad391226-15a8-461e-83a9-cb84086dfc86	80157841-685e-4661-b295-3621a4684a38	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	Itens para o Ajeum	2026-03-22 04:12:40.734704	2026-03-22 04:12:40.734705
\.


--
-- Data for Name: ajeum_item; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.ajeum_item (id, terreiro_id, ajeum_id, descricao, limite, deleted_at, created_at, updated_at) FROM stdin;
262df071-87ad-4c48-8377-382e880992f9	80157841-685e-4661-b295-3621a4684a38	ad391226-15a8-461e-83a9-cb84086dfc86	Pedaço de Bacon	3	\N	2026-03-22 04:12:40.73961	2026-03-22 04:12:40.739614
01ef8c9f-0c42-48eb-83f7-59ec79e61e63	80157841-685e-4661-b295-3621a4684a38	ad391226-15a8-461e-83a9-cb84086dfc86	Gomos de linguiça calabresa	9	\N	2026-03-22 04:12:40.739622	2026-03-22 04:12:40.739623
f3d8c715-cd4c-42a6-9d4d-1291b9174472	80157841-685e-4661-b295-3621a4684a38	ad391226-15a8-461e-83a9-cb84086dfc86	Farinha de mandioca (kg)	2	\N	2026-03-22 04:12:40.739629	2026-03-22 04:12:40.73963
37e2adbe-11c3-436c-a874-d1c4a4b61587	80157841-685e-4661-b295-3621a4684a38	ad391226-15a8-461e-83a9-cb84086dfc86	Refrigerante	2	\N	2026-03-22 04:12:40.739635	2026-03-22 04:12:40.739636
9182615e-2155-4949-8db7-718cbb7e371c	80157841-685e-4661-b295-3621a4684a38	ad391226-15a8-461e-83a9-cb84086dfc86	Caixa de cerveja	2	\N	2026-03-22 04:12:40.739641	2026-03-22 04:12:40.739642
4e036547-c5c1-43cd-8057-fb27793c1845	80157841-685e-4661-b295-3621a4684a38	ad391226-15a8-461e-83a9-cb84086dfc86	Colher e copo descartável	2	\N	2026-03-22 04:12:40.739647	2026-03-22 04:12:40.739647
cd9e846e-eb63-4f76-9064-d4545274f9c4	80157841-685e-4661-b295-3621a4684a38	ad391226-15a8-461e-83a9-cb84086dfc86	Fígado de boi	1	\N	2026-03-22 12:49:41.451971	2026-03-22 12:49:41.451975
\.


--
-- Data for Name: ajeum_selecao; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.ajeum_selecao (id, terreiro_id, item_id, membro_id, status, version, confirmado_por, confirmado_em, created_at, updated_at) FROM stdin;
00fd225e-a264-4473-9798-8f8c6b5c2d6f	80157841-685e-4661-b295-3621a4684a38	37e2adbe-11c3-436c-a874-d1c4a4b61587	8870f645-8718-43e4-9f91-46c993d52556	selecionado	1	\N	\N	2026-03-22 04:29:44.182481	2026-03-22 04:29:44.182484
9bb95f42-3bac-4322-89a4-7ae853ef02b8	80157841-685e-4661-b295-3621a4684a38	37e2adbe-11c3-436c-a874-d1c4a4b61587	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	cancelado	1	\N	\N	2026-03-22 04:28:42.869477	2026-03-22 04:34:53.05664
f10c2c28-7af5-4fa5-a53e-dff272c5f9cb	80157841-685e-4661-b295-3621a4684a38	cd9e846e-eb63-4f76-9064-d4545274f9c4	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	selecionado	1	\N	\N	2026-03-22 12:50:33.200306	2026-03-22 12:50:33.200308
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.alembic_version (version_num) FROM stdin;
0015_inventory_system
\.


--
-- Data for Name: api_keys; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.api_keys (id, terreiro_id, user_id, prefix, key_hash, nome, descricao, scopes, ativa, expires_at, last_used_at, request_count, created_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.audit_logs (id, context, status, code, message, url, method, user_agent, created_at, user_id, ip, level, action, trace_id) FROM stdin;
14351d72-c3ab-4a5e-a459-115545043590	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-20 13:46:13.053885	03cba974-ff60-4295-8cd9-5600f70c0a4a	177.32.34.180	INFO	LOGIN_OK	80589684-ae0e-45c2-b202-2d64a626a74f
e4e66ec3-5c9e-4674-a0f4-ea5ed6058694	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-20 14:07:34.651189	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	LOGIN_OK	f9133c70-153f-419f-9962-84b384af25b3
e454cad8-633f-4490-9aa3-97b7f68beade	auth	200	\N	Login bem-sucedido: ogumxoroquetenda@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-20 16:31:49.355151	be63737a-f446-49a3-aa04-70b3f3b0fc59	177.196.7.206	INFO	LOGIN_OK	a5c0e143-e23f-4bc2-9037-9b3f3da5ff0a
902de13b-2429-487e-b118-f912463cf029	auth	200	\N	Login bem-sucedido: ogumxoroquetenda@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-20 16:31:49.356298	be63737a-f446-49a3-aa04-70b3f3b0fc59	177.196.7.206	INFO	LOGIN_OK	b985cbee-bbef-4d74-8c63-5defed11cead
c51f4fed-d55c-452f-a7d3-6affa8ac96b4	auth	200	\N	Senha alterada com sucesso	https://axeflow-backend.onrender.com/auth/senha	PATCH	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-20 17:17:35.413228	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	PASSWORD_CHANGED	e714745d-58bd-468d-9241-527f8e6abd3d
3501f137-95ad-48f5-8879-0bce7e93c71a	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-20 17:17:47.824248	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	LOGIN_OK	a410965d-12b6-4f94-977e-ef1b2f1e50ec
ee16adb0-2c89-4d4b-afc2-965524939672	auth	200	\N	Login bem-sucedido: ogumxoroquetenda@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-20 17:39:21.183	be63737a-f446-49a3-aa04-70b3f3b0fc59	177.196.7.206	INFO	LOGIN_OK	b0d7efbb-8a7a-42ff-9a48-80ddc85f4d56
bc37dc5d-9c37-4d63-acae-bb45775889f3	auth	200	\N	Token gerado: denis.leal07@gmail.com (terreiro: TOXTRA)	https://axeflow-backend.onrender.com/auth/esqueci-senha/enviar	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-20 17:46:50.227557	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	PASSWORD_RESET_REQUESTED	ee1ece7c-1235-48da-b7cc-861e5a5e6a39
834a4e44-3734-49d2-9a02-a6d018cb2e8e	auth	200	\N	Senha redefinida: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/redefinir-senha	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-20 17:47:28.102057	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	PASSWORD_RESET_OK	5b2cbf92-4f81-4e4c-a7ec-06c1067f15ba
c3a52fbf-21e4-4879-8492-14f183b3c8c7	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-20 17:47:40.19103	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	LOGIN_OK	f71348a7-0c28-4337-9f9d-5d6e97bcb153
77fa53b8-b608-4c46-aa85-8a902e18efe9	auth	200	\N	Login bem-sucedido: ogumxoroquetenda@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-20 17:48:28.695726	be63737a-f446-49a3-aa04-70b3f3b0fc59	187.43.133.51	INFO	LOGIN_OK	634321e9-9add-40b1-a7e2-d54361f0e71d
fa0bd9d1-133a-4dcd-8009-c36da1b5938a	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-20 17:48:53.990297	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	LOGIN_OK	f5ba0fc1-1afe-4aa9-8c2e-b76a8bf7777d
2c36b46b-7cbc-473d-ac88-278f6e1817f5	gira	200	\N	Gira editada: e23cedb7-1bdd-4d9f-b8a6-9451375366f6	https://axeflow-backend.onrender.com/giras/e23cedb7-1bdd-4d9f-b8a6-9451375366f6	PUT	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-21 22:09:08.223725	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	GIRA_UPDATED	8700eb5d-1f3d-4238-af6e-018713da9cb5
f7646826-51b6-4811-a4e2-50adeca2f321	gira	200	\N	Gira editada: e23cedb7-1bdd-4d9f-b8a6-9451375366f6	https://axeflow-backend.onrender.com/giras/e23cedb7-1bdd-4d9f-b8a6-9451375366f6	PUT	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-21 22:11:14.732666	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	GIRA_UPDATED	30be7e38-3b89-413a-9580-af494f17fbbe
5f99ea0f-cd56-42f9-be36-5f808dbcff14	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: araujoadeilda7@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-21 22:31:54.230305	\N	200.207.173.49	WARNING	LOGIN_FAILED	7331eee6-6655-4c80-9075-352867b49bab
f3a79c4e-00d4-499c-8c33-00f7a9d2da65	auth	200	\N	Login bem-sucedido: araujoadeilda7@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-21 22:32:03.023315	7e098c0a-ae1c-49fc-8894-1e4611e5b8e1	200.207.173.49	INFO	LOGIN_OK	6955fcc7-efa0-48e2-8559-7885f7e54a2d
aba18a4c-2225-4d69-bdd9-fafb87c23912	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 00:58:12.30235	\N	177.32.34.180	WARNING	LOGIN_FAILED	865d08dd-1bd0-4726-9e64-f306528b3fec
2e4000cb-8c00-4a52-a9b9-538793e13ed2	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 01:12:19.399013	\N	177.32.34.180	WARNING	LOGIN_FAILED	91653d4a-0bfd-4e9f-957b-ad489e6eb22f
a189a98c-6076-4408-885a-a4dca67ab94c	auth	200	\N	Novo terreiro criado: Terreiro Staging | admin: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/register	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 01:13:10.115049	\N	177.32.34.180	INFO	REGISTER_OK	2b7d6dd0-074e-4582-a70b-f3ad9a81de94
3a2a8fe2-7e82-44a4-85a2-22ea199d2202	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 01:13:18.208243	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	LOGIN_OK	44a5066a-aa9f-42fb-a49f-fbd0529d5491
1b660ae2-501d-4927-8ad8-47e4b8f33ee1	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 01:14:40.008712	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	LOGIN_OK	edd5e6ae-ecf4-470d-8a93-15413fa0b3e7
6c52e65a-48f1-484e-b2d7-264c0639f5de	gira	200	\N	Gira criada: Gira Exu (publica)	https://axeflow-backend.onrender.com/giras	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 01:16:25.543873	01f17662-b596-4f26-830f-3c8ee9c7c669	177.32.34.180	INFO	GIRA_CREATED	c65f1638-b648-4018-b592-16f635261526
198444c8-88e1-4351-8178-836e765b08cf	gira	200	\N	Gira editada: ad65f021-93a6-463a-b210-6daed785dd93	https://axeflow-backend.onrender.com/giras/ad65f021-93a6-463a-b210-6daed785dd93	PUT	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 01:52:26.732627	01f17662-b596-4f26-830f-3c8ee9c7c669	177.32.34.180	INFO	GIRA_UPDATED	5faf8ad4-c80c-4128-a1d1-7f160914ee29
f42111e9-c97c-45a4-98bd-b82b01c81403	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 01:59:35.099201	\N	177.32.34.180	WARNING	LOGIN_FAILED	978edac4-be3d-4af3-b469-3d71b414dd24
e37244f9-b95a-4f6d-a03c-0181c58596c6	auth	200	\N	Novo terreiro criado: Terreiro Staging | admin: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/register	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 01:59:58.804642	\N	177.32.34.180	INFO	REGISTER_OK	c519f2c7-5326-42e7-a01c-ebb9bd32c8cc
09068077-4d7c-465d-b5da-7bb4e5afaafe	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 02:19:35.808662	\N	177.32.34.180	WARNING	LOGIN_FAILED	75c29ccb-d472-4e5a-b8a9-6e6b43f80073
ccb2f2fa-06ad-4733-a7b0-1e2092fd5d3d	auth	200	\N	Novo terreiro criado: Terreiro Staging | admin: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/register	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 02:19:35.838363	\N	177.32.34.180	INFO	REGISTER_OK	47c9947e-d0af-42ba-837f-581e72c11f24
d28cf05d-27ac-4cf8-a050-baf8419f3164	auth	200	\N	Novo terreiro criado: Terreiro Staging | admin: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/register	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 02:31:50.820943	\N	177.32.34.180	INFO	REGISTER_OK	d71a3a9c-b768-4e81-8e9b-a7f05931c6f7
5b0c1a8e-e709-4129-bec2-07b7fb723288	ajeum	201	\N	Ajeum criado para gira=e23cedb7-1bdd-4d9f-b8a6-9451375366f6 com 6 itens	https://axeflow-backend.onrender.com/giras/e23cedb7-1bdd-4d9f-b8a6-9451375366f6/ajeum	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 04:12:44.213467	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	AJEUM_CRIADO	3ef53453-7bf7-4ec4-8006-4b38be92774f
03840b90-a8cf-478e-8f11-daaacd2177dd	auth	200	\N	Login bem-sucedido: ogumxoroquetenda@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 04:27:26.037301	be63737a-f446-49a3-aa04-70b3f3b0fc59	187.70.47.155	INFO	LOGIN_OK	56ac2b27-e89a-4cad-a81a-8b17e5f13b6a
48bce318-ec89-4dc3-a3a0-1519f02667d7	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 04:27:53.944238	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	187.70.47.155	INFO	LOGIN_OK	62188e89-5353-4692-b909-6c0889edda9e
a00b85e1-0b9a-4a50-8987-a76396f03151	ajeum	200	\N	Item selecionado: item=37e2adbe-11c3-436c-a874-d1c4a4b61587 membro=c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	https://axeflow-backend.onrender.com/ajeum/itens/37e2adbe-11c3-436c-a874-d1c4a4b61587/selecionar	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 04:28:45.96897	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	INFO	ITEM_SELECIONADO	a73258ad-6cc9-4c83-9f65-5583accc4968
98b80623-c20b-4301-9d43-f3fc5f2d60b8	auth	200	\N	Login bem-sucedido: ogumxoroquetenda@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 04:29:08.740844	be63737a-f446-49a3-aa04-70b3f3b0fc59	177.32.34.180	INFO	LOGIN_OK	3ca54b2f-7a17-4375-9a16-e1df108b9b29
1d3887d1-c023-403c-a555-c2f1c89ffbe1	ajeum	200	\N	Item selecionado: item=37e2adbe-11c3-436c-a874-d1c4a4b61587 membro=8870f645-8718-43e4-9f91-46c993d52556	https://axeflow-backend.onrender.com/ajeum/itens/37e2adbe-11c3-436c-a874-d1c4a4b61587/selecionar	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-03-22 04:29:47.429789	8870f645-8718-43e4-9f91-46c993d52556	104.28.63.99	INFO	ITEM_SELECIONADO	60caefa6-0b16-4233-9023-59dde388a724
e3301037-151d-4bf0-999f-08b014276b8a	ajeum	200	\N	Seleção cancelada: selecao=9bb95f42-3bac-4322-89a4-7ae853ef02b8	https://axeflow-backend.onrender.com/ajeum/selecoes/9bb95f42-3bac-4322-89a4-7ae853ef02b8	DELETE	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-03-22 04:34:53.067391	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	177.32.34.180	WARNING	SELECAO_CANCELADA	6e3f30ab-bd2f-4741-88b6-172bd6e52b9a
3cf9c907-e788-40f6-ae08-5b31be6b3ccd	ajeum	201	\N	Item adicionado: ajeum=ad391226-15a8-461e-83a9-cb84086dfc86 descricao=Fígado de boi	https://axeflow-backend.onrender.com/ajeum/ad391226-15a8-461e-83a9-cb84086dfc86/itens	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 12:49:44.902658	be63737a-f446-49a3-aa04-70b3f3b0fc59	187.70.58.185	INFO	ITEM_ADICIONADO	b86e5661-0878-4479-99c7-1a52405a209b
9a6f912c-c389-4cb6-bfc6-e5294dae10b2	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 12:50:23.606975	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	187.70.58.185	INFO	LOGIN_OK	ead57099-e870-4436-a88c-14610d4eebb0
06156925-64f8-4dd9-a1c7-52736995a426	ajeum	200	\N	Item selecionado: item=cd9e846e-eb63-4f76-9064-d4545274f9c4 membro=c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	https://axeflow-backend.onrender.com/ajeum/itens/cd9e846e-eb63-4f76-9064-d4545274f9c4/selecionar	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 12:50:36.238473	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	187.70.58.185	INFO	ITEM_SELECIONADO	671ba86f-94d2-4083-8890-19ac894a544f
b5eb75de-aa44-4316-82e3-22967a4fa695	gira	200	\N	Gira editada: e23cedb7-1bdd-4d9f-b8a6-9451375366f6	https://axeflow-backend.onrender.com/giras/e23cedb7-1bdd-4d9f-b8a6-9451375366f6	PUT	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 15:25:53.764973	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	187.26.178.29	INFO	GIRA_UPDATED	4eeedec4-67d7-4874-bf5c-0a45a4ba7b03
1ff9aee8-a84c-49e3-8583-78aca7854668	inscricao	200	\N	Presença atualizada: inscricao=44670c06-7094-402c-8d2b-d781c574e79d status=compareceu	https://axeflow-backend.onrender.com/inscricao/44670c06-7094-402c-8d2b-d781c574e79d/presenca	PATCH	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 22:36:49.572989	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	191.39.132.113	INFO	PRESENCA_UPDATED	0aa2d0a1-ffed-4b0c-ab54-9e9b168fec78
ae77cfed-4b92-480e-a318-7638e720e88a	inscricao	200	\N	Presença atualizada: inscricao=765d4a3e-6978-4b18-9948-f5716ce4c9f7 status=faltou	https://axeflow-backend.onrender.com/inscricao/765d4a3e-6978-4b18-9948-f5716ce4c9f7/presenca	PATCH	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 22:36:57.416681	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	191.39.132.113	INFO	PRESENCA_UPDATED	7970d85b-808b-4605-908c-6361207e7f0c
1b10855a-e490-4d49-b6b3-0e23a5c2e285	inscricao	200	\N	Presença atualizada: inscricao=8a4a27d5-fef6-47ad-a2d9-e6f0b8be661d status=compareceu	https://axeflow-backend.onrender.com/inscricao/8a4a27d5-fef6-47ad-a2d9-e6f0b8be661d/presenca	PATCH	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 22:38:36.70915	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	191.39.132.113	INFO	PRESENCA_UPDATED	3e0e5b37-6fd1-4600-8ca7-db0835e60306
9915706f-607c-4768-a5eb-e0f5fafdd20a	inscricao	200	\N	Presença atualizada: inscricao=f5a36e1f-ba04-4614-a4ce-9e7267bdad66 status=compareceu	https://axeflow-backend.onrender.com/inscricao/f5a36e1f-ba04-4614-a4ce-9e7267bdad66/presenca	PATCH	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 22:38:37.062385	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	191.39.132.113	INFO	PRESENCA_UPDATED	dea0e141-9140-47d8-951b-82f43e046fbf
b82552b4-910d-453d-b988-3d8d281fe864	inscricao	200	\N	Presença atualizada: inscricao=f5a36e1f-ba04-4614-a4ce-9e7267bdad66 status=compareceu	https://axeflow-backend.onrender.com/inscricao/f5a36e1f-ba04-4614-a4ce-9e7267bdad66/presenca	PATCH	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 22:38:37.07156	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	191.39.132.113	INFO	PRESENCA_UPDATED	8d474f9d-cc9d-44a2-bc44-3c0ed35051b5
c668a480-8a28-45ce-930d-4808fa37249f	inscricao	200	\N	Presença atualizada: inscricao=355a7c72-b236-4820-907e-968e0130fbe9 status=compareceu	https://axeflow-backend.onrender.com/inscricao/355a7c72-b236-4820-907e-968e0130fbe9/presenca	PATCH	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 22:38:42.885395	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	191.39.132.113	INFO	PRESENCA_UPDATED	e20069ca-c5cc-4a45-91b6-8b41281efdc9
acc5b6a7-e6ea-44e4-aad3-3c8de94cb95e	gira	200	\N	Gira editada: e23cedb7-1bdd-4d9f-b8a6-9451375366f6	https://axeflow-backend.onrender.com/giras/e23cedb7-1bdd-4d9f-b8a6-9451375366f6	PUT	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 22:40:13.859329	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	191.39.132.113	INFO	GIRA_UPDATED	2279d72e-3308-42da-b060-b1c95c022e88
5b2c63c5-846a-4461-83a0-d550fa963cb0	inscricao	200	\N	Presença atualizada: inscricao=360ac263-ca48-49f0-bfd8-be863e8ec509 status=faltou	https://axeflow-backend.onrender.com/inscricao/360ac263-ca48-49f0-bfd8-be863e8ec509/presenca	PATCH	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-22 22:38:40.421483	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	191.39.132.113	INFO	PRESENCA_UPDATED	72da9bc4-49f8-411a-8b1e-9df215025738
c1c191da-168e-48b1-a20f-6092e54e55b3	auth	200	\N	Login bem-sucedido: dbrandao566@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-24 23:12:34.250216	1b6bdb7c-d4a9-4855-aac4-b07f0ce6958f	131.255.37.92	INFO	LOGIN_OK	acdc2be4-fbab-4313-a629-2db4638c8cfc
39fde120-5255-499a-8bde-0f6b087213e7	auth	200	\N	Login bem-sucedido: brunazoran@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-03-27 13:57:28.338813	8870f645-8718-43e4-9f91-46c993d52556	172.225.223.48	INFO	LOGIN_OK	09ad12fa-d67c-4619-ad2d-e8b35190c319
6a9ad911-f35a-4cbf-8e2b-b674003f53c8	gira	200	\N	Gira criada: Gira de Ciganos e Malandros (publica)	https://axeflow-backend.onrender.com/giras	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-03-27 14:13:34.615608	8870f645-8718-43e4-9f91-46c993d52556	172.225.83.35	INFO	GIRA_CREATED	310c8b2b-101e-4ca2-9bc4-487a6ff887a6
bfd458ab-62e2-4e5d-89a3-61881f1147bc	auth	200	\N	Login bem-sucedido: lohaynneemilly10@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1	2026-03-27 16:58:43.630952	0a6d4199-ea52-4c23-88b1-2d7a14b504de	187.26.80.111	INFO	LOGIN_OK	32f80541-911a-4fc6-bd14-2820982f7d81
01fd3138-0235-45e7-a33f-9fba1d7ac04c	auth	200	\N	Login bem-sucedido: simichele@hotmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-03-27 20:12:54.941625	4824a93c-2048-4c3d-9548-7156ca8fabb5	200.53.202.94	INFO	LOGIN_OK	942c2641-b774-4346-a0ff-c77caf3be6e5
cf2fe193-5b68-4eb6-ad93-e4f00976c476	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-03-29 23:51:30.317452	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	187.43.154.134	INFO	LOGIN_OK	90eb18bb-6892-4b02-9cae-a466d0840ae6
773c7532-8a64-4fda-b1ee-00a775a694a9	auth	200	\N	Login bem-sucedido: brunazoran@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 26_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/146.0.7680.151 Mobile/15E148 Safari/604.1	2026-03-30 16:44:06.011275	8870f645-8718-43e4-9f91-46c993d52556	189.121.140.20	INFO	LOGIN_OK	38021f98-d6fa-4a70-b4dc-77563d6a5e0f
33b2a29e-319a-4630-af28-8f6c558b06fd	auth	200	\N	Login bem-sucedido: deby_2030@hotmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-03-30 17:12:34.31336	489d756c-3c09-430f-9005-70f0db6c0e3d	200.53.204.120	INFO	LOGIN_OK	f3d8211e-fb6f-4841-87ca-50e4c2cbaafe
d576b091-6520-4f59-9da4-4b922dddf2eb	auth	200	\N	Login bem-sucedido: deby_2030@hotmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-03-30 17:12:34.414228	489d756c-3c09-430f-9005-70f0db6c0e3d	200.53.204.120	INFO	LOGIN_OK	e5eefe49-54a0-489b-85f1-4a27a1128757
8bd4871f-39fc-4cd0-9369-e60d9441f7ce	auth	200	\N	Login bem-sucedido: deby_2030@hotmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-03-30 17:13:44.927279	489d756c-3c09-430f-9005-70f0db6c0e3d	200.53.204.120	INFO	LOGIN_OK	c35fd27f-31e0-4728-8056-b1a321fe8daa
45f4c5db-ad70-4329-8af4-c3f0ef6c0e28	auth	200	\N	Login bem-sucedido: deby_2030@hotmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-03-30 17:15:42.818326	489d756c-3c09-430f-9005-70f0db6c0e3d	200.53.204.120	INFO	LOGIN_OK	1260c398-11cf-430a-805a-264e8b46992e
62ce6e85-7ef7-482d-ad96-3efb4a260b3c	auth	200	\N	Login bem-sucedido: vivianeleite1973@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-02 16:25:42.21105	01afb34a-6a02-4ebc-a895-d7980f7a566e	138.36.56.159	INFO	LOGIN_OK	3e54b79c-605f-4fe0-9826-6ce8041d4d59
8a32a9a2-4feb-4e04-9e47-64eb68f6eecf	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: vivianeleite1973@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-02 16:36:50.79154	\N	138.36.56.159	WARNING	LOGIN_FAILED	c50a0791-4639-4f46-8a96-a35adbbfd218
95969fd3-6941-494d-a30b-710c5aa839cd	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: vivianeleite1973@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-02 16:36:55.89898	\N	138.36.56.159	WARNING	LOGIN_FAILED	66b8bec3-5d23-4676-9f2c-5e8dbe179146
365218ca-41d4-48b9-8050-5bc9eab07749	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: vivianeleite1973@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-02 16:37:39.895738	\N	138.36.56.159	WARNING	LOGIN_FAILED	950e3e7a-fb8a-43b4-9e83-7ceede6fdb24
a1b55a53-83e8-49d1-a23e-3b92919036c2	auth	200	\N	Login bem-sucedido: vivianeleite1973@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-03 14:02:16.864661	01afb34a-6a02-4ebc-a895-d7980f7a566e	138.36.56.159	INFO	LOGIN_OK	c3ec162d-9bb2-4231-88fd-bb7c1bfc9301
36a7ee6b-0333-49e5-bcfe-e1fc5b54a98e	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0	2026-04-03 14:54:07.17314	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	201.81.55.88	INFO	LOGIN_OK	3bbf309d-6861-463d-ad39-09380c518559
66de375d-c5ff-4d65-9198-0ba38d238bfa	auth	200	\N	Login bem-sucedido: brunazoran@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-04 18:35:29.772299	8870f645-8718-43e4-9f91-46c993d52556	172.225.83.38	INFO	LOGIN_OK	be4cf3a7-873b-4f34-8d78-4e7090ae0947
ea667e33-75d9-4455-9507-a167806d527e	auth	200	\N	Senha alterada com sucesso	https://axeflow-backend.onrender.com/auth/senha	PATCH	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-04 18:36:40.462555	8870f645-8718-43e4-9f91-46c993d52556	172.225.83.38	INFO	PASSWORD_CHANGED	d855758a-2e94-4804-b547-1d2cfa8a55dd
6e92d1c8-c8fe-4134-a49f-03953d4c9e5c	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: brunazoran@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 26_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/146.0.7680.151 Mobile/15E148 Safari/604.1	2026-04-04 18:38:43.059046	\N	177.144.160.133	WARNING	LOGIN_FAILED	fe057408-ed80-4b32-a890-0fa22ded7e89
a85c2c80-58a4-4e8b-a329-7d46ea4c9c1e	auth	200	\N	Login bem-sucedido: brunazoran@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 26_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/146.0.7680.151 Mobile/15E148 Safari/604.1	2026-04-04 18:39:13.162776	8870f645-8718-43e4-9f91-46c993d52556	177.144.160.133	INFO	LOGIN_OK	50ca6bef-2e9c-47b8-ac1c-91964a376349
43acfe1e-db6b-45e7-aef2-73f877966ca7	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: brunazoran@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-04 18:39:49.163808	\N	172.225.100.144	WARNING	LOGIN_FAILED	ceb9f4e6-ea19-40b4-8e6e-b9d99feb8595
9ae5bfc9-3e4e-445c-a849-9fd08ce7edae	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: brunazoran@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 26_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/146.0.7680.151 Mobile/15E148 Safari/604.1	2026-04-04 18:38:58.459236	\N	177.144.160.133	WARNING	LOGIN_FAILED	bcca4669-5d59-4efe-96df-7f42217de6e7
50fd5304-5165-4d6d-bd3d-91060ce084a8	auth	200	\N	Login bem-sucedido: brunazoran@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-04 18:39:59.170608	8870f645-8718-43e4-9f91-46c993d52556	172.225.100.144	INFO	LOGIN_OK	ded2fc0c-98f3-4679-935a-b797d80cb7b1
5beeba21-70b0-49a1-b475-bbfbcfbecb8c	auth	200	\N	Login bem-sucedido: denis.leal07@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-06 11:48:04.214578	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	187.70.20.226	INFO	LOGIN_OK	cfa0d934-1bf6-40e2-a17a-d926c01960bf
fde5910e-7b95-46e5-b877-d00dd8652099	auth	200	\N	Login bem-sucedido: lohaynneemilly10@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1	2026-04-06 13:41:53.162141	0a6d4199-ea52-4c23-88b1-2d7a14b504de	187.43.153.89	INFO	LOGIN_OK	9d077c6d-c390-4a93-8c17-cd576dd735b2
b5e0b5ce-359a-450b-9f1f-9bac246fb649	auth	200	\N	Login bem-sucedido: nessa.vlima@hotmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-06 16:21:43.176407	6e66575c-6582-446c-b0b8-f65dba28146c	191.39.144.31	INFO	LOGIN_OK	8907cf72-ab34-402b-bed6-c367d6dbaa48
516b5905-40cd-4c23-80d9-7e50c44149a9	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: giselefieladeuss2@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-06 19:07:44.12288	\N	190.102.46.113	WARNING	LOGIN_FAILED	d99af854-8eda-4007-8bb1-1d534eefd66e
3a0ba784-5e5c-4e80-928a-ad25318a1b86	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: giselefieladeuss2@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-06 19:08:03.521932	\N	190.102.46.113	WARNING	LOGIN_FAILED	ef715c42-cdd6-46c7-96e5-d3501bfc36f3
44aaec2a-65c7-46d0-a6d4-a97b6960b225	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: giselefieladeuss2@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-06 19:08:09.210255	\N	190.102.46.113	WARNING	LOGIN_FAILED	344888f3-d216-4c4b-8b64-3ffc1ecc0ed1
b460bc8a-2652-4f97-9278-085b0b25b5b2	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: giselefieladeuss2@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-06 19:08:19.213147	\N	190.102.46.113	WARNING	LOGIN_FAILED	751ac079-82d0-4fe7-a4be-e46dbaac007e
7f1100e9-2e17-4b83-bb54-abdc16ff4d2a	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: giselefieladeuss2@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-06 19:08:26.411292	\N	190.102.46.113	WARNING	LOGIN_FAILED	6f20c396-9cce-46a7-8b44-a71f35be715d
22e2f8a1-c28a-467a-9f79-e2e8a8c64799	auth	200	\N	Token gerado: giselefieladeuss2@gmail.com (terreiro: TOXTRA)	https://axeflow-backend.onrender.com/auth/esqueci-senha/enviar	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-06 19:08:41.638362	619ddfdb-8107-4271-ae3d-4285367e20e9	190.102.46.113	INFO	PASSWORD_RESET_REQUESTED	4ea18ea3-7236-4f88-97b6-b63c46874964
0ce16d42-9712-4c7d-9231-263e4b4a00b0	auth	200	\N	Senha redefinida: giselefieladeuss2@gmail.com	https://axeflow-backend.onrender.com/auth/redefinir-senha	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-06 19:12:22.314737	619ddfdb-8107-4271-ae3d-4285367e20e9	190.102.46.113	INFO	PASSWORD_RESET_OK	8af6bc4c-ee20-4253-bf62-59355f273a2c
a76ad16f-00c7-4c14-9a24-7efb0ba96cb9	auth	200	\N	Login bem-sucedido: giselefieladeuss2@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	2026-04-06 19:13:38.934137	619ddfdb-8107-4271-ae3d-4285367e20e9	190.102.46.113	INFO	LOGIN_OK	676bd2f9-69f7-473e-bc06-2f5fec095e2c
93a59760-fd8a-4821-bd3c-cb4d7dd493d7	auth	200	\N	Login bem-sucedido: deby_2030@hotmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-07 22:13:05.208884	489d756c-3c09-430f-9005-70f0db6c0e3d	200.53.205.106	INFO	LOGIN_OK	ebb0f008-76c1-40cb-8e3f-f336fd81f3c8
85f47803-57b4-4580-9762-b77a5905602b	inscricao	200	\N	Presença atualizada: inscricao=0e013fa4-c302-4bf4-a242-5599b3ba4925 status=faltou	https://axeflow-backend.onrender.com/inscricao/0e013fa4-c302-4bf4-a242-5599b3ba4925/presenca	PATCH	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1	2026-04-08 00:21:38.768009	0a6d4199-ea52-4c23-88b1-2d7a14b504de	177.23.123.170	INFO	PRESENCA_UPDATED	28fb8b4b-b76f-4663-b35d-6af008953cac
274b5143-f885-4de0-bd00-06d836cd6546	inscricao	200	\N	Presença atualizada: inscricao=0e013fa4-c302-4bf4-a242-5599b3ba4925 status=compareceu	https://axeflow-backend.onrender.com/inscricao/0e013fa4-c302-4bf4-a242-5599b3ba4925/presenca	PATCH	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1	2026-04-08 00:21:45.555489	0a6d4199-ea52-4c23-88b1-2d7a14b504de	177.23.123.170	INFO	PRESENCA_UPDATED	27fc611e-4697-44a0-9cff-e828f48b5006
6661d016-7ed1-40f7-bd70-1e92a3e0e7ef	inscricao	200	\N	Inscrição cancelada: 0e013fa4-c302-4bf4-a242-5599b3ba4925	https://axeflow-backend.onrender.com/inscricao/0e013fa4-c302-4bf4-a242-5599b3ba4925	DELETE	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1	2026-04-08 00:21:47.055155	0a6d4199-ea52-4c23-88b1-2d7a14b504de	177.23.123.170	WARNING	INSCRICAO_CANCELADA	aeb0caeb-18cd-49c4-bb99-d2436eddb586
731db574-3c49-453d-be23-6aebfc2bbb07	inscricao	200	\N	Presença atualizada: inscricao=0e013fa4-c302-4bf4-a242-5599b3ba4925 status=compareceu	https://axeflow-backend.onrender.com/inscricao/0e013fa4-c302-4bf4-a242-5599b3ba4925/presenca	PATCH	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1	2026-04-08 00:21:47.219166	0a6d4199-ea52-4c23-88b1-2d7a14b504de	177.23.123.170	INFO	PRESENCA_UPDATED	acd2e46c-5c44-4a2a-bf3c-6881e82e6f35
2b24e6a6-c46d-4e26-9048-cf1bed0aae4c	inscricao	200	\N	Presença atualizada: inscricao=0e013fa4-c302-4bf4-a242-5599b3ba4925 status=compareceu	https://axeflow-backend.onrender.com/inscricao/0e013fa4-c302-4bf4-a242-5599b3ba4925/presenca	PATCH	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1	2026-04-08 00:21:48.722364	0a6d4199-ea52-4c23-88b1-2d7a14b504de	177.23.123.170	INFO	PRESENCA_UPDATED	3a2a197d-abbf-4364-9716-87354f3c5a36
55f4355c-f33f-4ae0-9e92-c3f03b94f5e9	inscricao	200	\N	Presença atualizada: inscricao=0e013fa4-c302-4bf4-a242-5599b3ba4925 status=faltou	https://axeflow-backend.onrender.com/inscricao/0e013fa4-c302-4bf4-a242-5599b3ba4925/presenca	PATCH	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1	2026-04-08 00:21:50.510381	0a6d4199-ea52-4c23-88b1-2d7a14b504de	177.23.123.170	INFO	PRESENCA_UPDATED	d5f52967-7228-495b-988f-a5a609e5f2c3
277aacf5-f33c-41b7-869e-6748178fe04c	inscricao	200	\N	Presença atualizada: inscricao=0e013fa4-c302-4bf4-a242-5599b3ba4925 status=faltou	https://axeflow-backend.onrender.com/inscricao/0e013fa4-c302-4bf4-a242-5599b3ba4925/presenca	PATCH	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1	2026-04-08 00:21:55.255998	0a6d4199-ea52-4c23-88b1-2d7a14b504de	177.23.123.170	INFO	PRESENCA_UPDATED	b543174f-4716-46ba-b5eb-5da132cdba78
1793335c-75a6-41fc-aa9c-1034cb2e260d	inscricao	200	\N	Inscrição cancelada: 0e013fa4-c302-4bf4-a242-5599b3ba4925	https://axeflow-backend.onrender.com/inscricao/0e013fa4-c302-4bf4-a242-5599b3ba4925	DELETE	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1	2026-04-08 00:21:58.403837	0a6d4199-ea52-4c23-88b1-2d7a14b504de	177.23.123.170	WARNING	INSCRICAO_CANCELADA	d59f8aec-a0b3-46de-9bb6-ff6354c29393
074b70d9-1c9b-4641-bc8b-05d2320c8908	auth	401	ERR_INVALID_CREDENTIALS	Tentativa de login falhou: enzoincrep181112@gmail.com	https://axeflow-backend.onrender.com/auth/login	POST	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1	2026-04-08 02:45:15.959162	\N	201.92.87.87	WARNING	LOGIN_FAILED	24087689-b927-464e-96fb-fbf27c2e333d
\.


--
-- Data for Name: consulentes; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.consulentes (id, nome, telefone, primeira_visita, created_at, updated_at, notas) FROM stdin;
038ee59b-fa9e-4337-be30-f77003a0e400	João 	11966100928	t	2026-03-09 13:48:27.13412	\N	\N
fc6c6219-3814-435f-a273-94844f97c5e3	Denis 	11966100929	f	2026-03-09 13:46:12.549311	\N	\N
a7f06a52-ec95-4099-aba1-8ef4b6df75fe	Gabryelle	11965911688	t	2026-03-09 20:15:57.652805	\N	\N
cd11f9c0-c396-4797-b30c-a01edec9c388	Denis Leal	5511966100929	t	2026-03-12 03:34:21.411366	2026-03-12 03:34:21.411369	\N
bfb3109f-7c42-410a-8db7-54c04378c0cb	Gabryelle 	5511965911688	t	2026-03-15 22:38:00.884082	2026-03-15 22:38:00.884084	\N
3029adf9-d652-464a-841d-bd6430598734	Denis Teste	5511966100921	t	2026-03-18 20:16:37.915565	2026-03-18 20:16:37.915567	\N
ca9094f4-dd3d-45a4-9691-b9ccad1dc850	Denis Teste 2	5511966100622	t	2026-03-18 20:18:14.25371	2026-03-18 20:18:14.253712	\N
cbdf196d-8f89-4098-8014-6343a798fd6a	Allanys Gomes	5511993650613	t	2026-03-19 00:10:41.816947	2026-03-19 00:10:41.816948	\N
20e77fb3-b69c-4a54-9d89-902241870b63	Matheus da Silva Pereira 	5511954657972	t	2026-03-19 00:20:51.257396	2026-03-19 00:20:51.2574	\N
056d6bca-3ad1-4856-8221-7ade95a35b82	Sofia gerena de Lima 	5511937010631	t	2026-03-19 00:21:33.991266	2026-03-19 00:21:33.991268	\N
36b75345-d1c4-4b99-9fe2-a7b3f77ad4ee	Gizane Alves Espíndola 	5511994141882	t	2026-03-19 00:53:43.90119	2026-03-19 00:53:43.901193	\N
44fbe207-429d-4365-9fb6-f77bb7a64733	Flávio Gomes de Almeida 	5511940112895	t	2026-03-19 01:40:33.556926	2026-03-19 01:40:33.556927	\N
2605ec31-5ab4-4f0d-9aae-a065eefa2f44	Denis Leal Teste	5511966100924	t	2026-03-19 16:17:18.899764	2026-03-19 16:17:18.899766	\N
44c4e849-b307-418a-8e98-abfcaaadd01b	Alex limberg	5511940474495	f	2026-03-19 00:13:05.031473	2026-04-06 13:41:14.510348	\N
c5718641-db60-4a24-81ea-60bb4c9f3724	Alex Crepaldi	5511960633967	f	2026-04-06 20:12:41.041514	2026-04-06 20:12:41.041516	\N
e7bd56d0-e72c-4021-8808-6ecd7f2d9a1a	Jorge Santana	5511994189337	t	2026-04-06 20:15:33.16339	2026-04-06 20:15:33.163392	\N
a04fd572-2f82-4c28-b20f-0a52a92267ce	Aline	5511970397720	f	2026-04-06 22:57:37.375668	2026-04-06 22:57:37.37567	\N
35ab4b80-85bd-4b00-9ab4-b673ce206545	Arthur	5511940848161	f	2026-04-06 23:15:05.19914	2026-04-06 23:15:05.199142	\N
\.


--
-- Data for Name: gira_item_consumptions; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.gira_item_consumptions (id, terreiro_id, gira_id, medium_id, inventory_item_id, source, quantity, status, movement_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: gira_notifications; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.gira_notifications (id, gira_id, user_id, type, created_at, read_at) FROM stdin;
\.


--
-- Data for Name: giras; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.giras (id, terreiro_id, titulo, tipo, data, horario, limite_consulentes, abertura_lista, fechamento_lista, responsavel_lista_id, status, slug_publico, created_at, acesso, deleted_at, updated_at, limite_membros, estoque_processado) FROM stdin;
e23cedb7-1bdd-4d9f-b8a6-9451375366f6	80157841-685e-4661-b295-3621a4684a38	Gira de Exu	Exus	2026-03-22	02:00:00	15	2026-03-15 14:00:00	2026-03-22 13:30:00	0a6d4199-ea52-4c23-88b1-2d7a14b504de	concluida	gira-de-exu-2026-03-22-685a	2026-03-15 18:26:24.566052	publica	\N	2026-03-22 22:40:10.057141	\N	f
238a688c-8188-49eb-9223-18de19c8c78a	80157841-685e-4661-b295-3621a4684a38	Gira de Ciganos e Malandros		2026-04-12	14:00:00	15	2026-03-27 11:03:00	2026-04-12 11:03:00	8870f645-8718-43e4-9f91-46c993d52556	aberta	gira-de-ciganos-e-malandros-2026-04-12-438b	2026-03-27 14:13:31.034963	publica	\N	2026-03-27 14:13:31.034966	\N	f
\.


--
-- Data for Name: inscricoes_consulente; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.inscricoes_consulente (id, gira_id, consulente_id, posicao, status, observacoes, created_at, updated_at) FROM stdin;
57dd91db-0b14-4082-9877-8c8ebe9d7830	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	cbdf196d-8f89-4098-8014-6343a798fd6a	3	cancelado	\N	2026-03-19 00:10:41.822685	2026-03-19 23:58:06.540503
44670c06-7094-402c-8d2b-d781c574e79d	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	bfb3109f-7c42-410a-8db7-54c04378c0cb	1	compareceu	\N	2026-03-15 22:38:00.893044	2026-03-22 22:36:49.541771
765d4a3e-6978-4b18-9948-f5716ce4c9f7	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	36b75345-d1c4-4b99-9fe2-a7b3f77ad4ee	7	faltou	\N	2026-03-19 00:53:43.91606	2026-03-22 22:36:57.406014
8a4a27d5-fef6-47ad-a2d9-e6f0b8be661d	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	20e77fb3-b69c-4a54-9d89-902241870b63	5	compareceu	\N	2026-03-19 00:20:51.265026	2026-03-22 22:38:36.698299
f5a36e1f-ba04-4614-a4ce-9e7267bdad66	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	44c4e849-b307-418a-8e98-abfcaaadd01b	4	compareceu	\N	2026-03-19 00:13:05.035163	2026-03-22 22:38:37.059959
360ac263-ca48-49f0-bfd8-be863e8ec509	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	44fbe207-429d-4365-9fb6-f77bb7a64733	8	faltou	\N	2026-03-19 01:40:33.562574	2026-03-22 22:38:40.414658
355a7c72-b236-4820-907e-968e0130fbe9	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	056d6bca-3ad1-4856-8221-7ade95a35b82	6	compareceu	\N	2026-03-19 00:21:34.006645	2026-03-22 22:38:42.876798
356b605b-1339-4294-b5a2-3f6b670da482	238a688c-8188-49eb-9223-18de19c8c78a	44c4e849-b307-418a-8e98-abfcaaadd01b	1	confirmado	\N	2026-04-06 13:41:14.515203	2026-04-06 13:41:14.515205
ee55b23f-cd19-4687-9154-d8519d46c68f	238a688c-8188-49eb-9223-18de19c8c78a	e7bd56d0-e72c-4021-8808-6ecd7f2d9a1a	3	confirmado	\N	2026-04-06 20:15:33.167869	2026-04-06 20:15:33.167871
908594e5-af3d-4adb-b017-ab667aaeb5d0	238a688c-8188-49eb-9223-18de19c8c78a	a04fd572-2f82-4c28-b20f-0a52a92267ce	4	confirmado	\N	2026-04-06 22:57:37.383765	2026-04-06 22:57:37.383768
c43d1cd4-e34e-42a4-b137-c092dc37cf8b	238a688c-8188-49eb-9223-18de19c8c78a	35ab4b80-85bd-4b00-9ab4-b673ce206545	5	confirmado	\N	2026-04-06 23:15:05.211147	2026-04-06 23:15:05.21115
0e013fa4-c302-4bf4-a242-5599b3ba4925	238a688c-8188-49eb-9223-18de19c8c78a	c5718641-db60-4a24-81ea-60bb4c9f3724	2	faltou	\N	2026-04-06 20:12:41.048158	2026-04-08 00:21:55.154729
\.


--
-- Data for Name: inscricoes_gira; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.inscricoes_gira (id, gira_id, consulente_id, posicao, status, created_at, membro_id, observacoes, updated_at) FROM stdin;
ee55b23f-cd19-4687-9154-d8519d46c68f	238a688c-8188-49eb-9223-18de19c8c78a	e7bd56d0-e72c-4021-8808-6ecd7f2d9a1a	3	confirmado	2026-04-06 20:15:33.169328	\N	\N	2026-04-06 20:15:33.16933
908594e5-af3d-4adb-b017-ab667aaeb5d0	238a688c-8188-49eb-9223-18de19c8c78a	a04fd572-2f82-4c28-b20f-0a52a92267ce	4	confirmado	2026-04-06 22:57:37.386	\N	\N	2026-04-06 22:57:37.386002
c43d1cd4-e34e-42a4-b137-c092dc37cf8b	238a688c-8188-49eb-9223-18de19c8c78a	35ab4b80-85bd-4b00-9ab4-b673ce206545	5	confirmado	2026-04-06 23:15:05.215175	\N	\N	2026-04-06 23:15:05.215177
597e0d78-0ecc-4a8a-9467-c816b649ffc0	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	\N	2	confirmado	2026-03-18 22:04:59.356861	0a6d4199-ea52-4c23-88b1-2d7a14b504de	\N	2026-03-18 22:04:59.356863
288a700c-d802-453b-819f-e933eeebb8c7	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	\N	10	confirmado	2026-03-19 14:53:03.276991	0d4a1a07-a70c-4b83-b040-dcf47a55c4c6	\N	2026-03-19 14:53:03.276994
1a3b0792-04c2-4009-ad2e-e809bd59c800	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	\N	11	confirmado	2026-03-19 14:57:19.494381	619ddfdb-8107-4271-ae3d-4285367e20e9	\N	2026-03-19 14:57:19.494384
1ac0b52c-7b6a-4044-9ac1-7e7a3623b669	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	\N	12	confirmado	2026-03-19 14:58:40.16178	6e66575c-6582-446c-b0b8-f65dba28146c	\N	2026-03-19 14:58:40.161781
563e2897-eb11-4e78-a883-ed0598cb2233	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	\N	13	confirmado	2026-03-19 15:07:57.101367	01afb34a-6a02-4ebc-a895-d7980f7a566e	\N	2026-03-19 15:07:57.101369
a284a5c9-8203-49d5-9d03-82a2a5342798	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	\N	14	confirmado	2026-03-19 15:30:53.482472	8870f645-8718-43e4-9f91-46c993d52556	\N	2026-03-19 15:30:53.482474
2597ca2b-f169-46ad-9d16-382b9b10ce15	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	\N	15	confirmado	2026-03-19 22:06:03.174387	eb982068-66d9-4ec6-aade-e9562bdc742b	\N	2026-03-19 22:06:03.174389
990bb764-0b32-41d0-9f94-bf3fb857b462	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	\N	16	confirmado	2026-03-19 22:21:27.569741	3a9de8ea-312d-4a63-8ebc-7fd2ab91789b	\N	2026-03-19 22:21:27.569744
57dd91db-0b14-4082-9877-8c8ebe9d7830	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	cbdf196d-8f89-4098-8014-6343a798fd6a	3	cancelado	2026-03-19 00:10:41.822685	\N	\N	2026-03-19 23:58:06.540503
1ff16da0-c737-4e37-84b1-a7eae8d3e7a1	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	\N	16	confirmado	2026-03-20 01:05:20.403806	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	\N	2026-03-20 01:05:20.403808
44670c06-7094-402c-8d2b-d781c574e79d	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	bfb3109f-7c42-410a-8db7-54c04378c0cb	1	compareceu	2026-03-15 22:38:00.893044	\N	\N	2026-03-22 22:36:49.533074
765d4a3e-6978-4b18-9948-f5716ce4c9f7	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	36b75345-d1c4-4b99-9fe2-a7b3f77ad4ee	7	faltou	2026-03-19 00:53:43.91606	\N	\N	2026-03-22 22:36:57.401743
8a4a27d5-fef6-47ad-a2d9-e6f0b8be661d	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	20e77fb3-b69c-4a54-9d89-902241870b63	5	compareceu	2026-03-19 00:20:51.265026	\N	\N	2026-03-22 22:38:36.696557
f5a36e1f-ba04-4614-a4ce-9e7267bdad66	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	44c4e849-b307-418a-8e98-abfcaaadd01b	4	compareceu	2026-03-19 00:13:05.035163	\N	\N	2026-03-22 22:38:37.054381
360ac263-ca48-49f0-bfd8-be863e8ec509	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	44fbe207-429d-4365-9fb6-f77bb7a64733	8	faltou	2026-03-19 01:40:33.562574	\N	\N	2026-03-22 22:38:40.41365
355a7c72-b236-4820-907e-968e0130fbe9	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	056d6bca-3ad1-4856-8221-7ade95a35b82	6	compareceu	2026-03-19 00:21:34.006645	\N	\N	2026-03-22 22:38:42.87504
356b605b-1339-4294-b5a2-3f6b670da482	238a688c-8188-49eb-9223-18de19c8c78a	44c4e849-b307-418a-8e98-abfcaaadd01b	1	confirmado	2026-04-06 13:41:14.517419	\N	\N	2026-04-06 13:41:14.517421
0e013fa4-c302-4bf4-a242-5599b3ba4925	238a688c-8188-49eb-9223-18de19c8c78a	c5718641-db60-4a24-81ea-60bb4c9f3724	2	faltou	2026-04-06 20:12:41.050514	\N	\N	2026-04-08 00:21:55.153645
\.


--
-- Data for Name: inscricoes_membro; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.inscricoes_membro (id, gira_id, membro_id, posicao, status, created_at, updated_at) FROM stdin;
337dc2c5-3b9b-4f57-a580-cee7fde5a91f	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	be63737a-f446-49a3-aa04-70b3f3b0fc59	10	compareceu	2026-03-21 16:51:23.929033	2026-03-22 15:57:24.833401
1a3b0792-04c2-4009-ad2e-e809bd59c800	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	619ddfdb-8107-4271-ae3d-4285367e20e9	11	compareceu	2026-03-19 14:57:19.494381	2026-03-22 15:57:30.6569
288a700c-d802-453b-819f-e933eeebb8c7	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	0d4a1a07-a70c-4b83-b040-dcf47a55c4c6	10	compareceu	2026-03-19 14:53:03.276991	2026-03-22 15:57:35.849902
1ac0b52c-7b6a-4044-9ac1-7e7a3623b669	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	6e66575c-6582-446c-b0b8-f65dba28146c	12	compareceu	2026-03-19 14:58:40.16178	2026-03-22 15:57:40.29669
597e0d78-0ecc-4a8a-9467-c816b649ffc0	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	0a6d4199-ea52-4c23-88b1-2d7a14b504de	2	compareceu	2026-03-18 22:04:59.356861	2026-03-22 15:57:42.320704
dcb08a07-ae9b-4819-88bd-e061c3f4c3b2	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	7e098c0a-ae1c-49fc-8894-1e4611e5b8e1	11	compareceu	2026-03-21 22:32:29.788157	2026-03-22 15:57:43.608471
5d99b037-db97-4dd4-871d-053b376df32f	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	9	compareceu	2026-03-20 14:05:14.499171	2026-03-22 15:57:47.063727
2597ca2b-f169-46ad-9d16-382b9b10ce15	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	eb982068-66d9-4ec6-aade-e9562bdc742b	15	compareceu	2026-03-19 22:06:03.174387	2026-03-22 16:07:42.346837
563e2897-eb11-4e78-a883-ed0598cb2233	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	01afb34a-6a02-4ebc-a895-d7980f7a566e	13	compareceu	2026-03-19 15:07:57.101367	2026-03-22 16:07:45.86877
990bb764-0b32-41d0-9f94-bf3fb857b462	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	3a9de8ea-312d-4a63-8ebc-7fd2ab91789b	16	compareceu	2026-03-19 22:21:27.569741	2026-03-22 16:07:47.609483
c28a2857-90d2-4615-b983-28c4d613c9e9	238a688c-8188-49eb-9223-18de19c8c78a	0a6d4199-ea52-4c23-88b1-2d7a14b504de	2	confirmado	2026-03-27 16:58:46.920402	2026-03-27 16:58:46.920405
80c72bb4-a572-487a-8031-aad385bd55f5	238a688c-8188-49eb-9223-18de19c8c78a	8870f645-8718-43e4-9f91-46c993d52556	3	confirmado	2026-03-30 13:40:09.380987	2026-03-30 13:40:09.38099
d89b9bec-d081-42e1-b9c6-8ad84f59f753	e23cedb7-1bdd-4d9f-b8a6-9451375366f6	8870f645-8718-43e4-9f91-46c993d52556	11	compareceu	2026-04-03 15:27:44.727923	2026-04-03 15:27:44.727926
b279b1c2-ae5e-4be2-a9eb-c268b00a9816	238a688c-8188-49eb-9223-18de19c8c78a	6e66575c-6582-446c-b0b8-f65dba28146c	4	confirmado	2026-04-06 16:21:52.080256	2026-04-06 16:21:52.080258
6bb30123-8a0a-48d1-974a-847a21d5ef18	238a688c-8188-49eb-9223-18de19c8c78a	619ddfdb-8107-4271-ae3d-4285367e20e9	5	confirmado	2026-04-06 19:14:52.2629	2026-04-06 19:14:52.262902
4c4c52c8-3a05-4891-a988-b87e07988d4e	238a688c-8188-49eb-9223-18de19c8c78a	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	5	confirmado	2026-04-07 22:12:38.520813	2026-04-07 22:12:38.520815
\.


--
-- Data for Name: inventory_alerts; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.inventory_alerts (id, inventory_item_id, triggered_at, resolved_at, last_notified_at) FROM stdin;
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.inventory_items (id, terreiro_id, owner_id, name, category, minimum_threshold, unit_cost, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: inventory_movements; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.inventory_movements (id, inventory_item_id, type, quantity, gira_id, created_by, notes, created_at) FROM stdin;
\.


--
-- Data for Name: inventory_owners; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.inventory_owners (id, type, reference_id) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.password_reset_tokens (id, user_id, terreiro_id, token_hash, expires_at, used_at, created_at) FROM stdin;
769ecd3b-4762-47ac-a87d-8db0fdddc573	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	80157841-685e-4661-b295-3621a4684a38	016b6dbfe2c7671dd397cd38c49c388a778db2b70b56a2e48923b59702cb3b94	2026-03-20 18:46:49.393069	2026-03-20 17:47:28.090968	2026-03-20 17:46:49.394916
267b7fa8-c101-4bad-9692-c3b1b54d139f	619ddfdb-8107-4271-ae3d-4285367e20e9	80157841-685e-4661-b295-3621a4684a38	8b1fc553d15f7b939a8eea341fa067d1c6b8f96da06f07f0deca097c6a3a938f	2026-04-06 20:08:40.758922	2026-04-06 19:12:22.216645	2026-04-06 19:08:40.76008
\.


--
-- Data for Name: push_subscriptions; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.push_subscriptions (id, endpoint, p256dh, auth, created_at, updated_at, user_id, terreiro_id) FROM stdin;
f68da5d8-3053-4028-8b2e-a71aad169926	https://fcm.googleapis.com/fcm/send/evACX0-Mqrc:APA91bE_DjqM_rTM9BRCezMPDRFdM6LxvEfk85BIC9EfGE899z8MIO20WPyyjdCkSqWAWQ55kB1YYcPAOdjNkzhqGJt69qvMEUYB9XfggVmsthCV7ozm2NQ-wClsR1PPDyEYrcLimvHa	BAH0jtDYMF5renX7pbJpsUVXY7w3BXUz396IjQPlhs8hpIe4hZ6y8U1eej5RHblnFKKoNEtgYkfSHVLc3oA0d10	vL_GRgHZpPHFxOHG-RKWlw	2026-03-09 15:03:04.511966	2026-03-09 15:03:04.511971	\N	\N
6e874e7b-8c8b-4407-8d20-b323aca73e99	https://fcm.googleapis.com/fcm/send/c0M7a_OW7Fw:APA91bFRsKpJYaa8EV55AUxIKMWVE_kyUFAhg-ivUXVnqVSX93qunEdnLOSB9UZ5mk2IHa2QGJf8A9iTtlViCBvNDD9WACoR-LeiuOq5t_vq2pLDPAM7zv2APDDIwZMqpxwlgdSaQuAg	BCCxjrfTmQSRs98nxKvvLoJvVUNtrIClBnAMT1az8G7kiDVGvkAFmvQRSW-8TGNYJB8fqXtZaFI49gjNpH7wgPg	y_UDahGnA6dlgvL4msyMMw	2026-03-09 17:35:39.759115	2026-03-09 17:35:39.75912	\N	\N
def0e83e-6e95-4052-95a5-02c158eaf26b	https://fcm.googleapis.com/fcm/send/ctSg7qzWSWE:APA91bHXes-ojABKEsWS8jzfpeGuuU36hna72vXrpzcSJbFImXSAfE2dNldQczuH9tcT01t1ahbFOgHvKLrANZ513-dJy6vVc5kl1G58HSdTsSA9pWjFrmCo8MF1oOTewbMjdj68Ez98	BAnsGTQXlYYkmkXHXMSVB11uG6-Sl6GvQ7aBNxXBOf5o4qxKtMTSJFvqJ3xq1iY63LZFufGWmcfRui4Lv4vjq50	WO1T5fO46RNeJwKne5OVkg	2026-03-09 20:27:09.534981	2026-03-09 20:27:09.534984	\N	\N
c2b4c9ab-e72d-4932-8ea1-5f8709813e8c	https://wns2-bl2p.notify.windows.com/w/?token=BQYAAABHIzRfWHN%2fgyZJElgKrwGbYocwC01Ffxhxl0YcdBBsaT99izYIzWdxZlEvJGqHWbh6Gq2GTsZLX7qLVOyO%2f8PRQM%2b8NIBaojAo4zFUF%2b4aRvvqYczc71mh2USjN1ev2dFKkZsxwKmTDdwrvV3eV9X8inIHPyhbI3ebFiZIUV2EXEvjxAUXMMZ1Qk7%2fmSIGE0ln6rWkN9P%2flsatL1ehcZS%2btrcAv%2bEadyJiM5pk3GqlOFySa03KwVoq%2ffxFtBldeMhGYEid7GyNEGZw5EqSkkizFXMKGqGOVZMwpS%2ffod6oRAevbQi8bgQtMJiRFmh6kGK7CfeUoJReOKn5osDg%2fvIY	BNJLKinV0hTmpOluYUX88CB4fkEegqpL40LzdS4quoGy4uGPJep2x2YJqLS-3OAkAIpYg32vChCc7jehB3NKBpk	pDvHY7cWDU2By7cZZhub9g	2026-03-09 20:28:32.154417	2026-03-09 20:28:32.154421	\N	\N
053ba048-46bd-4c3c-8bc3-e3af894a1dd0	https://wns2-bl2p.notify.windows.com/w/?token=BQYAAAAKUh5jE%2fsi82Gf1KCnz5rSWtEaQrWmWHKrXHFKnsoGKZ9%2f%2fN4pMqkpjrpbG7dPM43gzMv%2bFEU6eP1MwThcneMbSEFcT%2fBPkT1be%2fHBU3Ka66OmA9RzGaGMHqw%2fIzydit%2b3m6rtOoUdrEqTVBuQDOEDDPLfbnrxaLo67fImJtiaCq8%2fIUBqG3ATKtJkGFSX3ae7bKyGzKOi0Zgz2A4Zrq5JbI8Tr84yf3%2fqPtCkdCEMlHgUbbXw4P3KiWHaRPZTyM3IX7X1lkRCTAIRYppX7vXOAkpaS4rYe%2b%2fWBvuVXsPzUDtfxJ7B1PLyd84ZGBjhJ6w%3d	BCZoXBWdx58_pilxBhFEHHjWdG1L4rYmpDK8K16TtnwzZaEiVoH5X9so_3MvuZLEs0uBh8gcNilhPyZTid4pL4I	sLwBkMBiOnTv91xudBX9fQ	2026-03-12 03:15:44.525822	2026-03-12 03:15:44.525826	\N	\N
65e5e3ca-7b8b-4592-bac8-2c8c7ac8a334	https://web.push.apple.com/QPpN_szFxLFmCfoX-gkvqlyxmEAfQqm7L_JB7FSWLzIm6B92WnG60ZEi3YDbaqcrcfN9ZFQgTCNnavn4onUHxn7gSzS4hz-NYQSfdrAaZv0B07pKDDxNVgk3QjaI4BNjEeu-j-zqSRsT8vGOowBXCX23RrbpLQVVbcljxXTHf3c	BIWYu618ysDDqsB-g4XBLVcuUtPC26oFKN1v2LUPyUC7k8xJc1ByGCmSrN0itIaxqmNXJZwsA0e2NkMblMWGwnc	sW3mqmuxgrVrWbYk8KdBXA	2026-03-15 18:29:41.983447	2026-03-15 18:29:41.983449	\N	\N
ecef9426-7ddf-4bb4-acdc-bc5e6297418c	https://fcm.googleapis.com/fcm/send/dttw2SzHmTs:APA91bHvhufGMePQTHTWc3ne_w3aJmPmlu-TJGEZ2A34UW8OEyDvdn-VS8xiYcqlxJqq5PFsxVxid1Z0NEPp2xCF92n4UYk2UFqcuT2Vj1fAScPq7PdvLu-uISKiWR7RuZTr278ENxuJ	BJhGhr2lFqV319P03Bndco481Dn0e0STaDbiAqXOwsaCC-SLqIN_VCaJ0yGOq8-SRBnWChPrG575PYosNO8reQ8	v33EbwxfoxqhvFhKNImVeg	2026-03-17 16:12:47.089286	2026-03-17 16:12:47.08929	\N	\N
05622ca7-73fb-405e-844c-711c59d5a409	https://fcm.googleapis.com/fcm/send/epQAjrQA9Yc:APA91bHoU62BmM1qzQfP8360R7CPyN6JE09wZqsygT7kM3nouVpSQdMOMqkJX7iCHJT-YaYWaF_8-SWRJI_N_TlzEimfUT7hD2MH_iRNLTHXBhe9OckSWkwUXlzAIytAsioW3xgLiqBp	BG3_lWXOHX1QODCjueyXt3f32id3IBxfPrMz9oFXcpaZDCI-1EoapUPvGW8HDVQ5qrduIfEE9VqXG2hkebBfZEU	65e8PoF62exOsD5-sEBCsQ	2026-03-18 20:05:05.215503	2026-03-18 20:05:05.215506	be63737a-f446-49a3-aa04-70b3f3b0fc59	80157841-685e-4661-b295-3621a4684a38
9c6eec25-f995-4b86-98e5-974a656776f8	https://fcm.googleapis.com/fcm/send/fRGtyqEPidM:APA91bE7IiIvo92JJFXueA8V1g4pbExyDtFDrrEFwxtoMu4GlrtKUJytV-y9Xr3wFN-yHDM5lGDgrFU86IebHS8b2V6nxylLBGIBiGJ6Pn5NWmQcMYM1AntgyPnPZ2d045U2fNjppVhh	BEWe1FVIShcOz86xW8TBuzPb-46XOqcwfs2j8DET1G1MEupG5OV8xFyqefIH6CHoHDSOsbgxflHlFoQ9MN_5bMU	mmRdPGec2_VpoTRwSna3MQ	2026-03-18 20:19:07.667589	2026-03-18 20:19:07.667591	be63737a-f446-49a3-aa04-70b3f3b0fc59	80157841-685e-4661-b295-3621a4684a38
437d7309-18d6-4139-bd50-3514c11e9b13	https://fcm.googleapis.com/fcm/send/dt0sIaflKNc:APA91bE5R4T6buwX3AEEbKnUzZA76rHdnCYraNzTZ1730K6r5HDAHFPZEigOZr2W-VEaZ9sCKmPNU94MHyCqhIqHXDJZy0ToiBt365F3Sr0zPG75lY5I0ftL17KRMarm7OgLDjx46Vs1	BAJHALU4UMDBpvmR33okpq4VQZ50lkQavXik68k7EBKJ_T4vyZmhp-deMtipL_PX0bAXDK2nQPkkidXXGf6t-Nc	Y_Algm7RABm_aWtno5D6QA	2026-03-18 20:41:03.114701	2026-03-18 20:41:03.114704	be63737a-f446-49a3-aa04-70b3f3b0fc59	80157841-685e-4661-b295-3621a4684a38
81f863a0-ef5e-45e4-9991-9d3234f14dc6	https://web.push.apple.com/QDj1kpFD02kS6DwF1eZeyHAlJnNsmuNPow0R4hM9EDEYwvJfmyoe6fIsKJQJj2k0Auv6AJxH9pdiLmTFkJpY3jfPwbNxd0nzR1rALboQeBiGrcsFhfmXfIM0pC-0XkrDJlem-Y_j83bBguthM6SPX5gCExdjrTsOS_20MSd0QtQ	BGJwgQhQ23NOUPVHc1ZNBdF2doxpmk9Hw_t0uCFw-kNXpAyiQJnox2Wr_T-s9nv1zNcD9AKfVc-OQfoZHUHS54Q	_YaFfT9TM7FNHptWMbB5-w	2026-03-18 22:04:48.874598	2026-03-18 22:04:48.874601	0a6d4199-ea52-4c23-88b1-2d7a14b504de	80157841-685e-4661-b295-3621a4684a38
8cbadb65-4fac-4bee-9583-8b0695217c63	https://fcm.googleapis.com/fcm/send/cpXzCi7P4Gs:APA91bGJNiCtKMrHXiFoqUNGT48IH5f8qYPlYEFN7iLuWeu88KjtrazX-f0BREcLMjH0rP73RgYZNZq_LRh8osUriWLLxIC9-OMtNk8uImZJvLjeab0b-uFUjRhWrK9wVYE6nR4S9-YP	BESs8rzQuYOST81KbQYgU5XL6m4c25zdXP8PXw3xVZxrGuK21DDH3VSi5yrDY31pgUDiHuWL-EnOY1JBxe2mHdM	KUPb7xHrGCBaSmzf486Blw	2026-03-19 14:58:25.282993	2026-03-19 14:58:25.282995	be63737a-f446-49a3-aa04-70b3f3b0fc59	80157841-685e-4661-b295-3621a4684a38
7d29a682-561e-4f11-bb59-169776d4b3e3	https://fcm.googleapis.com/fcm/send/eCWtpU2ILzY:APA91bHnADC_CR2-JzTRfSvxDsQ4viPxJjPu8ooYv8tVA-1sAVq4gcitNW8k_MZP73oqbIpIEn-i79UaJlj5EHrlCecdIVX2u9iddIjLzcT9vfQEGouA-GOyCb83HRTZ2vizogH1pA_c	BOhHCjJAj00jPHhe_XfgN3qbR1GCJu0PQRyoK9NDlNI3ASMrWAcEicXbe2IrEn5RBKz2tJma5z_asEbIa08y-Pk	ej-WrytarLAk7JQQDQl1xw	2026-03-19 14:58:29.20929	2026-03-19 14:58:29.209292	be63737a-f446-49a3-aa04-70b3f3b0fc59	80157841-685e-4661-b295-3621a4684a38
249ca09c-25c6-42b2-9155-b74cfde24fb6	https://fcm.googleapis.com/fcm/send/dcsAgNyllkQ:APA91bFsvLnkT5yS3tvkPMSgNAMHtgC_XF_s9hhOMwA4ENIJCkAl7jfhb72PK4Tn5DGP8sk8rPRFGszbIH_tABnrGo-20pX9FDGrKIcR6zdbNcjBeDifvXcwSSEhzgK-S32Noqbz7mLJ	BA8hgg3SeTZwMLpn56k0gYPb23Wqv0bSTF6ibJBIXCmPAsQKxSf9KppFfM9HGuwG8_zugeNXzr87ahQjxrcttWg	voauGvvAwqe-OPAOgIeTzQ	2026-03-19 15:01:05.858803	2026-03-19 15:01:05.858806	619ddfdb-8107-4271-ae3d-4285367e20e9	80157841-685e-4661-b295-3621a4684a38
a70e7963-1a3f-44d6-9ffa-dfa04e0476f4	https://fcm.googleapis.com/fcm/send/cqfsdmIGAdY:APA91bEKM4Oo0gST5RS0moOy0JZE5zBg3igFDiZf_EIbPa0UUrzOw9-dqXrwEmn5LV3sg5GngLecicnNuFqXzPrvLg1KD4JluULMbqCBfXiv7CiFtoTO5vTn4f14XE1hz70NU8wO815I	BNatF0y1VxnRIikG8AscL5Tr9cGZdmL7YR6e3MdOobu0pa3xGZ9-EbYDWWCJw8BIyI4KKInN4ZrGg06L_EKxreg	bZzs_kMEQExSpN3cS4mSSg	2026-03-19 15:05:18.677847	2026-03-19 15:05:18.677848	619ddfdb-8107-4271-ae3d-4285367e20e9	80157841-685e-4661-b295-3621a4684a38
66dcfff1-5835-43d3-8181-83697f5e601e	https://web.push.apple.com/QHH_NAsO4aN9FBdWbeuislLzEyxxA87rV2TixvC3Sbe2ijI7odbKz0n_DY6Ofp7Hsk8lhuvbo1wLQkdu2g1QfQEgpK7bgyupO7ONZkomm2iEWxnSj7ba2sGAMee7w8pq-gHJQkf7uy-aAtSyYqJK0JPX9dA23eB8q6h04Jh5Nns	BNjOJ-5hSwmWBkMicKm3ABbOJuZCbVQfs126c2d7Hr6ybaf8KIHZ7cZ_Bh7sIEIqw160XsAlIsobwic6DUsLTu0	vrlBmshUdC3rPr3tBsSOZA	2026-03-19 16:19:58.738425	2026-03-19 16:19:58.738428	6e66575c-6582-446c-b0b8-f65dba28146c	80157841-685e-4661-b295-3621a4684a38
09883a1c-d6b0-4fce-befb-e783372bf410	https://fcm.googleapis.com/fcm/send/dtcn8NVLjeQ:APA91bE46sAeDLWBjZMvf_e_SQ6KoCym7weXZX487U82mlkcrO7jSGj8JcY-WGt6fH6-Db7nB6P2ZYe3j3de7wTw7E_ngljQ_Bo-TJJhkEgZxiSAkhz-Fm24UtF0jwJFA9xykT5_g4AP	BLmCXaF1tD5UpXlu16FqEqxAUTQDGcMpBn1iJlkt4QOWvWk9HcTo0tm-45fQkgKhtdfXED66qV7NqyIzxpTiRtI	cATorwlhVBblRpBL4QJVSA	2026-03-19 18:34:51.754357	2026-03-19 18:34:51.754359	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	80157841-685e-4661-b295-3621a4684a38
cb81d18a-286b-477a-9387-e5d50ff11a10	https://web.push.apple.com/QHr3AnRYhi9j2nhVHLIDxm75RF86dhzQGUZPJ9H3w2fuPNc_2fHx7Lfw6Ff_WM40-NLNHAAd2cy3Mrzs09dXOefCQiGEwE8N_xwPXOay7lZOSlaUEQATXIzGqUhrnuGXxgrgOH3A4qspWF5hVC5YNfZ-jBBA6-nEUqf6YQDHRZY	BHH7DQjMPzjJf3qGCEkjsfMaDvFYd1pXRkEheY2mhxQ0Bf4ztBSZaSWvsAmOjb1vqJRY-vLriaLW4URwQDWyI_Q	leaLeMOfsF-6gVsSprKnrw	2026-03-20 01:17:18.826971	2026-03-20 01:17:18.826973	8870f645-8718-43e4-9f91-46c993d52556	80157841-685e-4661-b295-3621a4684a38
a581687a-c63e-497f-878b-a61ae9fbd15d	https://fcm.googleapis.com/fcm/send/d_vpk6ODfOg:APA91bFZNaMAozfUseC7ICiJTwS8tzQDmAkphZ9OMQNr8SGb-toY0AyIDwQ1Wv6PgOrEifUqPOucxgukC2C49OaTXsTWVIpmrxbK84EGu9QbxZMf_12SUyt3hF-Lxt1nH2009b7ix01y	BPNcDvDabcxR60UnjtF954yiH8Ge53zAhoj2JgkAVNynjeCQc77j0AHPVZOefcIlNz-ZEfXvUMrW8zamETW5y6M	Z9co6S2pdeQ2ykOzAZV6ww	2026-03-20 14:05:07.141815	2026-03-20 14:05:07.141817	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	80157841-685e-4661-b295-3621a4684a38
bbecae2c-4e02-464e-a394-7928edf0d1b4	https://fcm.googleapis.com/fcm/send/d6RcNY06D3k:APA91bEP562Us6NY0wGyNo1ps5x_uG51_y_RlVeyEnQwyIf4Ozb1njhgnLemcm8XumimPFcabf9oG0z1omG2lRwDmj0kwD20OMBlOZAaDlAbZMKSJu7lkIT5fuC-TLyoW4iNz7d-Xj97	BB2GO9a8xBE6_tLXS2-VjN_i84lUzR4OjmGX08WbkjBoix2v6XRj-5PYMdMg9NJGi8-EG42u4OlYt2erZDgbVjg	-drMmJegJtO63H-iT4MYwQ	2026-03-21 22:32:17.656559	2026-03-21 22:32:17.656562	7e098c0a-ae1c-49fc-8894-1e4611e5b8e1	80157841-685e-4661-b295-3621a4684a38
0684cd97-c2da-4119-a06b-697a29ffc87c	https://fcm.googleapis.com/fcm/send/cc86CPxLXgg:APA91bGFkyJf0i9chWHi61UzqaVZy1PlfQRQ8LYLw60spgip8IYSBeKEJ6dajHhArp7fbUGQoSLDfg9mAWY9VQsXJ32rzfUFGpyVppq-NzITWZzJlfMrxasW4ymW2Fd7l4epzgoCG8r0	BLJ3VziT1i44pktPa_ADw5gZXiBoMjUineDOfuPWo_ymjunigOVbShNS4Glc5SlmIz4JOPevb-xlYIFahmO0nqQ	2Hcx1QnujXboQ51eJSIlqA	2026-03-22 15:25:05.790784	2026-03-22 15:25:05.790786	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	80157841-685e-4661-b295-3621a4684a38
b212ecd9-3dad-41e3-8551-1ae0181ef37e	https://fcm.googleapis.com/fcm/send/fxXU9aRFHbA:APA91bE9jIhmhFXXoOXdJePj1v596oXc0Q8MND_huEE6dG_mL0GdsK8p9tF8PyyZxMmMdgf8yQ6F39T4zpEdDGEYjgG3pumYOT0MwPdwzXc6nP2dhqx8UQo4gLec0h2Zc9U4SIcQrARB	BBgF_aBZeD93E5WQmJo5S5Rv_BbzBkUqcKuoNM0Y_8tO9Rz9ybuIuWnJ0Z9QYUZUQ_7Sma3Z65aEeZSwy9l7dZE	72Vc-zC6-cjxPQuUberuVg	2026-03-29 23:51:37.808917	2026-03-29 23:51:37.808918	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	80157841-685e-4661-b295-3621a4684a38
b29930c6-25ec-42b8-8b40-4893544a914f	https://wns2-bl2p.notify.windows.com/w/?token=BQYAAACh6ltNfEyPdG1bSwADeLECWTiH7UF3Fk2%2bKTNKTRNJpXLMVyTSgcrzw9elP9VBbVO9Um3cBupTTinmyQ8Rs4snRewwkcYagj1M3cS7Cn1Ca5%2fJvSNji5j06GGh%2bPWVyZyo3ycc2MpeZLH7XoCcwfuGV9iwVPKALRy6uu3hbewdwb6pq%2fCMVBfkqhejcoe83%2b8u5aF3UwTfg%2bqscRaqulvHP4hREiQAcco2QVAyj7jz%2boasz3UbeF6klw5QPvWvTsShbapv2BuljYZn%2fAdwvZgneNqm3jaT6sJPkYadNOsYt7IutZfU7bjwQ0w%2fT0zqXYYdXMhdpcAgTsJjW%2bWaD%2bmf	BEMnyWswyfdLBPGS89WLmnR36lhcxEmOMrb1IdvSoOSM2dF3Icu9IGmCRWRav7AmtShxcMFA1iLhhNz6aRNgmkw	b6wdO0dbuE_EPgH1vxyH4w	2026-04-03 15:30:07.363312	2026-04-03 15:30:07.363316	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	80157841-685e-4661-b295-3621a4684a38
5acfb311-3460-4316-9eb2-ab3134af2b71	https://fcm.googleapis.com/fcm/send/f3dqWsGnsjo:APA91bEg3fMokkjVrPUhLhCNcYA_aNHLLwvg91rbyj4XpSSottTikZUpFH2r-SW-xqhMFKuZd1ObIDK6jcKuk76vFmX_eYEdRqVgrpFh_Roy_ikJZB-tRxFV1HbDVAxfjGc3M8hh2Ddo	BDW-_fKJcSykQAg-16Ie8zZ5taaJv-c89wGT0MbRfQPHbaqHwKobTlwwHxV9gcihgTLGQn7x2QBk4_LsCPwlBr0	3JKCbWv8T3z7IXh_fDq8Cw	2026-04-03 16:36:12.278153	2026-04-03 16:36:12.278156	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	80157841-685e-4661-b295-3621a4684a38
9b09b8ed-b123-4199-baa9-9a5702e8a71d	https://web.push.apple.com/QM2OIpoPgCq0td8S_-xL4vev11FpUkw2Wuvw0a7WsUtTSjJ_lUcutLhwKdR5fHTH_-cRZAkTZBPLaudQKZd3mW-wp5EOA5yBHbDCsh0eyuVgaifhOiNlN95V1BkGuJmZ_p09cYFu6lSLhLeQGX9WoVy3LFpFnL9KDIGDK2QrFmw	BHIGD73mQGtI6QDRjXFjyw2mQiC3RhtR787LPiD1LNdjZ65kBp1ilIbS-1E4TNgmG2rfXFPLtCxkMxA7qsgajhg	rmDPKltahzhjZItKrOJDkg	2026-04-04 18:40:32.608807	2026-04-04 18:40:32.60881	8870f645-8718-43e4-9f91-46c993d52556	80157841-685e-4661-b295-3621a4684a38
8ed5ab44-86ec-4147-9883-997face9f7e9	https://fcm.googleapis.com/fcm/send/ecDcYytn5Oc:APA91bHJO9B4jrsTgxQx41s2hi_2CQC5dfeTX9API2YkJKPo-xBQeoclsvjyXU7r-L7z6cAtXGs8E13INyA5xL7fZ4PdnO3wm2nJ1l1IryGGROhwEcpaM9AxKoHmxJs2r9k4DbjvphcC	BOXXQQ1rh-dVkVMcYJ4vqkiW3ZgIYeDxn7xYE_nWOd-nzWYIw63RlOlLjvYxLzTUFN-_UTkfw5HFC-haZNagLuQ	_KYm3HFo8EW4kdRfgo53XA	2026-04-06 13:46:50.941057	2026-04-06 13:46:50.941059	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	80157841-685e-4661-b295-3621a4684a38
3ec21cd7-3997-4576-94cb-564807a220e6	https://fcm.googleapis.com/fcm/send/fPNsD1aeZDg:APA91bEAzZ8dBMyZ_FPadwfBe8ogjAnI9L18SOVtJh9bgqhWeBiLPD8vIQnWb9X0Pg909E0Kg83V4xJalbuQk9c6E6mZLGK2yIhl4rtYjm-ZgGNvnDFJOJ-ZByenjJbVUx9HcJBz9PYy	BITP33oFSmLe9C995bOWDkTFivROOHLBQeNNc6XrbbyjmizXe1rPNuGNq6yIV9G7Y-QvYLHIalNsajul21ht3wo	mQLuF_LLlHUQSsVJTHLDaw	2026-04-06 21:09:48.345955	2026-04-06 21:09:48.345957	c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	80157841-685e-4661-b295-3621a4684a38
\.


--
-- Data for Name: terreiros; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.terreiros (id, nome, cidade, created_at) FROM stdin;
80157841-685e-4661-b295-3621a4684a38	TOXTRA	São Paulo	2026-03-15 18:22:30.858229
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: terreiro
--

COPY public.usuarios (id, terreiro_id, nome, telefone, email, senha_hash, role, ativo, created_at, updated_at) FROM stdin;
be63737a-f446-49a3-aa04-70b3f3b0fc59	80157841-685e-4661-b295-3621a4684a38	Daiane e Rafael 	11 915466798	ogumxoroquetenda@gmail.com	$2b$12$sBK59FOWS76aPKtyUhlhcOW5NYcICZyVFalrcp8/q78bjKa.dH2U6	admin	t	2026-03-15 18:22:32.646643	2026-03-15 18:22:32.646647
1b6bdb7c-d4a9-4855-aac4-b07f0ce6958f	80157841-685e-4661-b295-3621a4684a38	Dayane	11989500833	dbrandao566@gmail.com	$2b$12$K7YAIKj5hYBmlEaeZbsMr.R5oilc6HFBorgjsWXue/8EvkrQ9Gn6i	membro	t	2026-03-19 12:46:38.374425	2026-03-19 12:46:38.374428
56a25bd5-da6e-4a42-b763-e4d5c730b27e	80157841-685e-4661-b295-3621a4684a38	Yasmim	11974957170	yasmim.viana09@hotmail.com	$2b$12$vX/4w9LThwLBdSaCFMtdIeUl2FhpeLJuf8ntdVrK6sltxejRHwU7i	membro	t	2026-03-19 12:48:00.665538	2026-03-19 12:48:00.665542
f4b38662-e6dc-43c1-afc9-3a0783a9e1cd	80157841-685e-4661-b295-3621a4684a38	Antônio	11976896991	tony090671@gmail.com	$2b$12$rOGMvOiv1tOkr07/jkBdruX.y3HcY.j5AxNIibV3TJiuDQ4uP9Kym	membro	t	2026-03-19 12:48:47.767291	2026-03-19 12:48:47.767294
489d756c-3c09-430f-9005-70f0db6c0e3d	80157841-685e-4661-b295-3621a4684a38	Débora	11995290199	deby_2030@hotmail.com	$2b$12$CUGXjgLDRveDQQasHDkLm..Zc0ztfzZZFRpeY0whAXlAivogAfcla	membro	t	2026-03-19 12:49:36.767869	2026-03-19 12:49:36.767874
3a9de8ea-312d-4a63-8ebc-7fd2ab91789b	80157841-685e-4661-b295-3621a4684a38	Carlos	11958617946	caboleite2015@gmail.com	$2b$12$x3UqfgCaPg8/Y/mkA5t9u.r6kPiAVv/DTPwZnOqxLjmxe/fWRkevq	membro	t	2026-03-19 12:50:21.269604	2026-03-19 12:50:21.269608
01afb34a-6a02-4ebc-a895-d7980f7a566e	80157841-685e-4661-b295-3621a4684a38	Viviane	11951924443	vivianeleite1973@gmail.com	$2b$12$BZsQ.001.tj0athZHDNN5uXpMsJK.mkIF3bHCGOxl4j8Axlah2F8.	membro	t	2026-03-19 12:51:09.067564	2026-03-19 12:51:09.067567
dd362e5f-df5f-484a-8c01-88d5511cc9b0	80157841-685e-4661-b295-3621a4684a38	Reginaldo	11967755406	reginaldo_santo@hotmail.com	$2b$12$xF/lj6hEvXUSEaF9Ato/6.Zfq2LWLCozHjijPMAk.NJ/0GHfaMIXi	membro	t	2026-03-19 12:51:47.870641	2026-03-19 12:51:47.870645
bfb1b3cb-f831-4555-b340-17b8fb100ff3	80157841-685e-4661-b295-3621a4684a38	Enzo	11982840829	enzoincrep181112@gmail.com	$2b$12$U9j/LgOlGxGequSXVfGZ/OfJ77xFkkddg60K6l0sbel24ZKioX36q	membro	t	2026-03-19 12:52:37.066344	2026-03-19 12:52:37.066348
eb982068-66d9-4ec6-aade-e9562bdc742b	80157841-685e-4661-b295-3621a4684a38	Amanda	11966561080	amanda.lusquinha@gmail.com	$2b$12$TykZZraMCVxZ6NI2uMTFuubTdP.2/aY7t5FybkwORwKytHlMTHK5O	membro	t	2026-03-19 12:53:10.072254	2026-03-19 12:53:10.072258
4824a93c-2048-4c3d-9548-7156ca8fabb5	80157841-685e-4661-b295-3621a4684a38	Simone	11958737164	simichele@hotmail.com	$2b$12$z45Qb9jTHjhwqgOnlADYK.7nfZeoKyNoUOTszBRADq1JCNRLpWzVG	membro	t	2026-03-19 12:53:43.073073	2026-03-19 12:53:43.073079
f7fa869d-4ec2-44e5-9ed2-44978929bb73	80157841-685e-4661-b295-3621a4684a38	Bruna	11996440894	brunas2machados@gmail.com	$2b$12$bXUXLilolESrc77PbOInZuaBsER0alidANFq4fJJVimk.TF5AEytm	membro	t	2026-03-19 12:55:04.865267	2026-03-19 12:55:04.865271
0d4a1a07-a70c-4b83-b040-dcf47a55c4c6	80157841-685e-4661-b295-3621a4684a38	Allanys	11993650613	allanysgomes52@gmail.com	$2b$12$M0BgOEyEw0gpfVcTRmsj3efo3gaR3v7l7wXq0bGq4j3Wfo5S6n7ne	membro	t	2026-03-19 12:55:36.964998	2026-03-19 12:55:36.965004
6e66575c-6582-446c-b0b8-f65dba28146c	80157841-685e-4661-b295-3621a4684a38	Vanessa	11969665392	nessa.vlima@hotmail.com	$2b$12$H38GIiyyBhfGUGZMM22POekM5MQ/5eqszt3aWw3.FBP4QhO1nJj9K	membro	t	2026-03-19 12:56:10.874227	2026-03-19 12:56:10.874231
0a6d4199-ea52-4c23-88b1-2d7a14b504de	80157841-685e-4661-b295-3621a4684a38	Emilly 	11915259096	lohaynneemilly10@gmail.com	$2b$12$hIlFZ97NucGk5oAqYbIr7u8VXsx8xe9ODD.w7XdwhTmvqLEj6EMpq	operador	t	2026-03-15 18:23:55.952568	2026-03-19 12:56:22.364788
7e098c0a-ae1c-49fc-8894-1e4611e5b8e1	80157841-685e-4661-b295-3621a4684a38	Adeilda	11951775344	araujoadeilda7@gmail.com	$2b$12$ePN/nYbtBpbZ8TB3V89hxeiL2W.C9d8TdNPBXGlkpW8ua/3ZWj9ze	operador	t	2026-03-19 12:47:20.272503	2026-03-19 12:56:33.61229
0d8ae18f-0ec4-4e13-aa7a-74110e028a25	80157841-685e-4661-b295-3621a4684a38	Inês	11971223592	inesbarreiro_3@hotmail.com	$2b$12$9ROvsbB46T4JvUzU7fTdVuDkoxb/NLUWWcpG8b1MCt3olrdUKZLFO	membro	t	2026-03-20 01:27:46.157627	2026-03-20 01:27:46.157631
c07af7d0-64ad-4f1b-95a5-40d63fbb91b6	80157841-685e-4661-b295-3621a4684a38	Denis Leal	11966100929	denis.leal07@gmail.com	$2b$12$JkmxCzr0KS9I8UuL3zaf2eSKBIAJ/4juGHyQ2t0XGCh4NKOx8hMui	operador	t	2026-03-18 15:03:58.650148	2026-03-22 04:27:39.78734
8870f645-8718-43e4-9f91-46c993d52556	80157841-685e-4661-b295-3621a4684a38	Zoran	6186372778	brunazoran@gmail.com	$2b$12$joBlTq8Fne8wSIsUKj9wsOlwx7pM2zwyS9wA7OIxNrcdvWaeqdqV2	operador	t	2026-03-19 12:54:31.969043	2026-04-04 18:36:40.371049
619ddfdb-8107-4271-ae3d-4285367e20e9	80157841-685e-4661-b295-3621a4684a38	Gisele	11953857873	giselefieladeuss2@gmail.com	$2b$12$QpyzxUvz6qu.UCW/pkzDN.iF3nS1wt2rWr.cz5HWwGHnysiDEZnEu	membro	t	2026-03-19 12:32:29.031865	2026-04-06 19:12:22.22123
\.


--
-- Name: ajeum_item ajeum_item_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum_item
    ADD CONSTRAINT ajeum_item_pkey PRIMARY KEY (id);


--
-- Name: ajeum ajeum_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum
    ADD CONSTRAINT ajeum_pkey PRIMARY KEY (id);


--
-- Name: ajeum_selecao ajeum_selecao_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum_selecao
    ADD CONSTRAINT ajeum_selecao_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: consulentes consulentes_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.consulentes
    ADD CONSTRAINT consulentes_pkey PRIMARY KEY (id);


--
-- Name: consulentes consulentes_telefone_key; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.consulentes
    ADD CONSTRAINT consulentes_telefone_key UNIQUE (telefone);


--
-- Name: gira_item_consumptions gira_item_consumptions_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_item_consumptions
    ADD CONSTRAINT gira_item_consumptions_pkey PRIMARY KEY (id);


--
-- Name: gira_notifications gira_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_notifications
    ADD CONSTRAINT gira_notifications_pkey PRIMARY KEY (id);


--
-- Name: giras giras_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.giras
    ADD CONSTRAINT giras_pkey PRIMARY KEY (id);


--
-- Name: giras giras_slug_publico_key; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.giras
    ADD CONSTRAINT giras_slug_publico_key UNIQUE (slug_publico);


--
-- Name: inscricoes_consulente inscricoes_consulente_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_consulente
    ADD CONSTRAINT inscricoes_consulente_pkey PRIMARY KEY (id);


--
-- Name: inscricoes_gira inscricoes_gira_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_gira
    ADD CONSTRAINT inscricoes_gira_pkey PRIMARY KEY (id);


--
-- Name: inscricoes_membro inscricoes_membro_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_membro
    ADD CONSTRAINT inscricoes_membro_pkey PRIMARY KEY (id);


--
-- Name: inventory_alerts inventory_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_alerts
    ADD CONSTRAINT inventory_alerts_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_owners inventory_owners_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_owners
    ADD CONSTRAINT inventory_owners_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: terreiros terreiros_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.terreiros
    ADD CONSTRAINT terreiros_pkey PRIMARY KEY (id);


--
-- Name: ajeum uq_ajeum_gira; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum
    ADD CONSTRAINT uq_ajeum_gira UNIQUE (gira_id);


--
-- Name: ajeum_selecao uq_ajeum_selecao_item_membro; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum_selecao
    ADD CONSTRAINT uq_ajeum_selecao_item_membro UNIQUE (item_id, membro_id);


--
-- Name: gira_item_consumptions uq_consumption_gira_medium_item; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_item_consumptions
    ADD CONSTRAINT uq_consumption_gira_medium_item UNIQUE (gira_id, medium_id, inventory_item_id);


--
-- Name: gira_notifications uq_gira_notification_gira_user_type; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_notifications
    ADD CONSTRAINT uq_gira_notification_gira_user_type UNIQUE (gira_id, user_id, type);


--
-- Name: inscricoes_consulente uq_inscricao_consulente_gira; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_consulente
    ADD CONSTRAINT uq_inscricao_consulente_gira UNIQUE (gira_id, consulente_id);


--
-- Name: inscricoes_gira uq_inscricao_gira_consulente; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_gira
    ADD CONSTRAINT uq_inscricao_gira_consulente UNIQUE (gira_id, consulente_id);


--
-- Name: inscricoes_gira uq_inscricao_gira_membro; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_gira
    ADD CONSTRAINT uq_inscricao_gira_membro UNIQUE (gira_id, membro_id);


--
-- Name: inscricoes_membro uq_inscricao_membro_gira; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_membro
    ADD CONSTRAINT uq_inscricao_membro_gira UNIQUE (gira_id, membro_id);


--
-- Name: inventory_owners uq_inventory_owner_type_ref; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_owners
    ADD CONSTRAINT uq_inventory_owner_type_ref UNIQUE (type, reference_id);


--
-- Name: usuarios uq_usuario_email_terreiro; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT uq_usuario_email_terreiro UNIQUE (email, terreiro_id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: ix_ajeum_item_ajeum; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_ajeum_item_ajeum ON public.ajeum_item USING btree (ajeum_id);


--
-- Name: ix_ajeum_item_ajeum_ativo; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_ajeum_item_ajeum_ativo ON public.ajeum_item USING btree (ajeum_id, deleted_at);


--
-- Name: ix_ajeum_item_terreiro; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_ajeum_item_terreiro ON public.ajeum_item USING btree (terreiro_id);


--
-- Name: ix_ajeum_selecao_item_created; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_ajeum_selecao_item_created ON public.ajeum_selecao USING btree (item_id, created_at);


--
-- Name: ix_ajeum_selecao_item_status; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_ajeum_selecao_item_status ON public.ajeum_selecao USING btree (item_id, status);


--
-- Name: ix_ajeum_selecao_membro; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_ajeum_selecao_membro ON public.ajeum_selecao USING btree (membro_id);


--
-- Name: ix_ajeum_selecao_terreiro_membro; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_ajeum_selecao_terreiro_membro ON public.ajeum_selecao USING btree (terreiro_id, membro_id, status);


--
-- Name: ix_ajeum_terreiro_created; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_ajeum_terreiro_created ON public.ajeum USING btree (terreiro_id, created_at);


--
-- Name: ix_alert_item_aberto; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_alert_item_aberto ON public.inventory_alerts USING btree (inventory_item_id) WHERE (resolved_at IS NULL);


--
-- Name: ix_alert_item_resolved; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_alert_item_resolved ON public.inventory_alerts USING btree (inventory_item_id, resolved_at);


--
-- Name: ix_api_keys_ativa; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_api_keys_ativa ON public.api_keys USING btree (terreiro_id, ativa);


--
-- Name: ix_api_keys_key_hash; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_api_keys_key_hash ON public.api_keys USING btree (key_hash);


--
-- Name: ix_api_keys_terreiro; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_api_keys_terreiro ON public.api_keys USING btree (terreiro_id);


--
-- Name: ix_audit_logs_action; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: ix_audit_logs_context; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_audit_logs_context ON public.audit_logs USING btree (context);


--
-- Name: ix_audit_logs_context_created; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_audit_logs_context_created ON public.audit_logs USING btree (context, created_at);


--
-- Name: ix_audit_logs_created_at; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: ix_audit_logs_trace_id; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_audit_logs_trace_id ON public.audit_logs USING btree (trace_id);


--
-- Name: ix_audit_logs_user_created; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_audit_logs_user_created ON public.audit_logs USING btree (user_id, created_at);


--
-- Name: ix_consulentes_telefone; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_consulentes_telefone ON public.consulentes USING btree (telefone);


--
-- Name: ix_consumption_gira; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_consumption_gira ON public.gira_item_consumptions USING btree (gira_id);


--
-- Name: ix_consumption_medium; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_consumption_medium ON public.gira_item_consumptions USING btree (medium_id);


--
-- Name: ix_consumption_terreiro_status; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_consumption_terreiro_status ON public.gira_item_consumptions USING btree (terreiro_id, status);


--
-- Name: ix_giras_slug_publico; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_giras_slug_publico ON public.giras USING btree (slug_publico);


--
-- Name: ix_giras_terreiro_data; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_giras_terreiro_data ON public.giras USING btree (terreiro_id, data);


--
-- Name: ix_inscricao_consulente_created_at; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inscricao_consulente_created_at ON public.inscricoes_consulente USING btree (gira_id, created_at);


--
-- Name: ix_inscricao_consulente_posicao; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inscricao_consulente_posicao ON public.inscricoes_consulente USING btree (gira_id, posicao);


--
-- Name: ix_inscricao_consulente_status; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inscricao_consulente_status ON public.inscricoes_consulente USING btree (gira_id, status);


--
-- Name: ix_inscricao_gira_created_at; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inscricao_gira_created_at ON public.inscricoes_gira USING btree (gira_id, created_at);


--
-- Name: ix_inscricao_gira_posicao; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inscricao_gira_posicao ON public.inscricoes_gira USING btree (gira_id, posicao);


--
-- Name: ix_inscricao_gira_status; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inscricao_gira_status ON public.inscricoes_gira USING btree (gira_id, status);


--
-- Name: ix_inscricao_membro_status; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inscricao_membro_status ON public.inscricoes_membro USING btree (gira_id, status);


--
-- Name: ix_inventory_item_owner; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inventory_item_owner ON public.inventory_items USING btree (owner_id);


--
-- Name: ix_inventory_item_terreiro; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inventory_item_terreiro ON public.inventory_items USING btree (terreiro_id);


--
-- Name: ix_inventory_item_terreiro_ativo; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inventory_item_terreiro_ativo ON public.inventory_items USING btree (terreiro_id, deleted_at);


--
-- Name: ix_inventory_owner_reference; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_inventory_owner_reference ON public.inventory_owners USING btree (reference_id);


--
-- Name: ix_movement_created_by; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_movement_created_by ON public.inventory_movements USING btree (created_by);


--
-- Name: ix_movement_gira; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_movement_gira ON public.inventory_movements USING btree (gira_id);


--
-- Name: ix_movement_item_created; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_movement_item_created ON public.inventory_movements USING btree (inventory_item_id, created_at);


--
-- Name: ix_notification_gira; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_notification_gira ON public.gira_notifications USING btree (gira_id);


--
-- Name: ix_notification_user_read; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_notification_user_read ON public.gira_notifications USING btree (user_id, read_at);


--
-- Name: ix_prt_expires_at; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_prt_expires_at ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: ix_prt_token_hash; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_prt_token_hash ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: ix_prt_user_id; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE INDEX ix_prt_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: ix_push_subscriptions_endpoint; Type: INDEX; Schema: public; Owner: terreiro
--

CREATE UNIQUE INDEX ix_push_subscriptions_endpoint ON public.push_subscriptions USING btree (endpoint);


--
-- Name: ajeum ajeum_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum
    ADD CONSTRAINT ajeum_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuarios(id);


--
-- Name: ajeum ajeum_gira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum
    ADD CONSTRAINT ajeum_gira_id_fkey FOREIGN KEY (gira_id) REFERENCES public.giras(id);


--
-- Name: ajeum_item ajeum_item_ajeum_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum_item
    ADD CONSTRAINT ajeum_item_ajeum_id_fkey FOREIGN KEY (ajeum_id) REFERENCES public.ajeum(id);


--
-- Name: ajeum_item ajeum_item_terreiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum_item
    ADD CONSTRAINT ajeum_item_terreiro_id_fkey FOREIGN KEY (terreiro_id) REFERENCES public.terreiros(id);


--
-- Name: ajeum_selecao ajeum_selecao_confirmado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum_selecao
    ADD CONSTRAINT ajeum_selecao_confirmado_por_fkey FOREIGN KEY (confirmado_por) REFERENCES public.usuarios(id);


--
-- Name: ajeum_selecao ajeum_selecao_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum_selecao
    ADD CONSTRAINT ajeum_selecao_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.ajeum_item(id);


--
-- Name: ajeum_selecao ajeum_selecao_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum_selecao
    ADD CONSTRAINT ajeum_selecao_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.usuarios(id);


--
-- Name: ajeum_selecao ajeum_selecao_terreiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum_selecao
    ADD CONSTRAINT ajeum_selecao_terreiro_id_fkey FOREIGN KEY (terreiro_id) REFERENCES public.terreiros(id);


--
-- Name: ajeum ajeum_terreiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.ajeum
    ADD CONSTRAINT ajeum_terreiro_id_fkey FOREIGN KEY (terreiro_id) REFERENCES public.terreiros(id);


--
-- Name: api_keys api_keys_terreiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_terreiro_id_fkey FOREIGN KEY (terreiro_id) REFERENCES public.terreiros(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: inscricoes_gira fk_inscricoes_gira_gira_id; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_gira
    ADD CONSTRAINT fk_inscricoes_gira_gira_id FOREIGN KEY (gira_id) REFERENCES public.giras(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions fk_push_terreiro; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT fk_push_terreiro FOREIGN KEY (terreiro_id) REFERENCES public.terreiros(id);


--
-- Name: push_subscriptions fk_push_user; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES public.usuarios(id);


--
-- Name: gira_item_consumptions gira_item_consumptions_gira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_item_consumptions
    ADD CONSTRAINT gira_item_consumptions_gira_id_fkey FOREIGN KEY (gira_id) REFERENCES public.giras(id);


--
-- Name: gira_item_consumptions gira_item_consumptions_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_item_consumptions
    ADD CONSTRAINT gira_item_consumptions_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: gira_item_consumptions gira_item_consumptions_medium_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_item_consumptions
    ADD CONSTRAINT gira_item_consumptions_medium_id_fkey FOREIGN KEY (medium_id) REFERENCES public.usuarios(id);


--
-- Name: gira_item_consumptions gira_item_consumptions_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_item_consumptions
    ADD CONSTRAINT gira_item_consumptions_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.inventory_movements(id);


--
-- Name: gira_item_consumptions gira_item_consumptions_terreiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_item_consumptions
    ADD CONSTRAINT gira_item_consumptions_terreiro_id_fkey FOREIGN KEY (terreiro_id) REFERENCES public.terreiros(id);


--
-- Name: gira_notifications gira_notifications_gira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_notifications
    ADD CONSTRAINT gira_notifications_gira_id_fkey FOREIGN KEY (gira_id) REFERENCES public.giras(id);


--
-- Name: gira_notifications gira_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.gira_notifications
    ADD CONSTRAINT gira_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id);


--
-- Name: giras giras_responsavel_lista_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.giras
    ADD CONSTRAINT giras_responsavel_lista_id_fkey FOREIGN KEY (responsavel_lista_id) REFERENCES public.usuarios(id);


--
-- Name: giras giras_terreiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.giras
    ADD CONSTRAINT giras_terreiro_id_fkey FOREIGN KEY (terreiro_id) REFERENCES public.terreiros(id);


--
-- Name: inscricoes_consulente inscricoes_consulente_consulente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_consulente
    ADD CONSTRAINT inscricoes_consulente_consulente_id_fkey FOREIGN KEY (consulente_id) REFERENCES public.consulentes(id);


--
-- Name: inscricoes_consulente inscricoes_consulente_gira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_consulente
    ADD CONSTRAINT inscricoes_consulente_gira_id_fkey FOREIGN KEY (gira_id) REFERENCES public.giras(id) ON DELETE CASCADE;


--
-- Name: inscricoes_gira inscricoes_gira_consulente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_gira
    ADD CONSTRAINT inscricoes_gira_consulente_id_fkey FOREIGN KEY (consulente_id) REFERENCES public.consulentes(id);


--
-- Name: inscricoes_gira inscricoes_gira_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_gira
    ADD CONSTRAINT inscricoes_gira_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.usuarios(id);


--
-- Name: inscricoes_membro inscricoes_membro_gira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_membro
    ADD CONSTRAINT inscricoes_membro_gira_id_fkey FOREIGN KEY (gira_id) REFERENCES public.giras(id) ON DELETE CASCADE;


--
-- Name: inscricoes_membro inscricoes_membro_membro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inscricoes_membro
    ADD CONSTRAINT inscricoes_membro_membro_id_fkey FOREIGN KEY (membro_id) REFERENCES public.usuarios(id);


--
-- Name: inventory_alerts inventory_alerts_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_alerts
    ADD CONSTRAINT inventory_alerts_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: inventory_items inventory_items_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.inventory_owners(id);


--
-- Name: inventory_items inventory_items_terreiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_terreiro_id_fkey FOREIGN KEY (terreiro_id) REFERENCES public.terreiros(id);


--
-- Name: inventory_movements inventory_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id);


--
-- Name: inventory_movements inventory_movements_gira_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_gira_id_fkey FOREIGN KEY (gira_id) REFERENCES public.giras(id);


--
-- Name: inventory_movements inventory_movements_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: password_reset_tokens password_reset_tokens_terreiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_terreiro_id_fkey FOREIGN KEY (terreiro_id) REFERENCES public.terreiros(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_terreiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: terreiro
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_terreiro_id_fkey FOREIGN KEY (terreiro_id) REFERENCES public.terreiros(id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO terreiro;


--
-- Name: DEFAULT PRIVILEGES FOR TYPES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TYPES TO terreiro;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO terreiro;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TABLES TO terreiro;


--
-- PostgreSQL database dump complete
--

\unrestrict cBzsW1d3ZxPszuLFUmo7UdM5sJsTzN68CX2CaLE3hlkPZTcR5wirGTu50YZATLP

