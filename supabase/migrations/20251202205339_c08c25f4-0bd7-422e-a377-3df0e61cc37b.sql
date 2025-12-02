-- Add unique constraint to delivery_zones.bairro if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'delivery_zones_bairro_unique'
  ) THEN
    ALTER TABLE public.delivery_zones ADD CONSTRAINT delivery_zones_bairro_unique UNIQUE (bairro);
  END IF;
END $$;

-- Clear and repopulate items
DELETE FROM extras;
DELETE FROM items;

-- TAPIOCAS
INSERT INTO items (category_id, name, price, allow_tapioca_molhada, is_molhado_by_default, allow_extras) VALUES
('ebed5017-611c-495f-bd69-52e46ec6970a', 'Tapioca com manteiga', 3.00, true, false, true),
('ebed5017-611c-495f-bd69-52e46ec6970a', 'Tapioca com ovo', 5.00, true, false, true),
('ebed5017-611c-495f-bd69-52e46ec6970a', 'Tapioca com queijo', 5.00, true, false, true),
('ebed5017-611c-495f-bd69-52e46ec6970a', 'Tapioca com carne moída', 7.00, true, false, true),
('ebed5017-611c-495f-bd69-52e46ec6970a', 'Tapioca dupla molhada', 14.00, true, true, true),
('ebed5017-611c-495f-bd69-52e46ec6970a', 'Tapioca com carne/queijo/ovo/verdura', 12.00, true, false, true),
('ebed5017-611c-495f-bd69-52e46ec6970a', 'Tapioca mista', 6.00, true, false, true);

-- CUSCUZ
INSERT INTO items (category_id, name, price, allow_extras, allow_tapioca_molhada) VALUES
('ba9685bf-686d-43eb-9355-7644cf3924b3', 'Cuscuz com manteiga', 5.00, false, false),
('ba9685bf-686d-43eb-9355-7644cf3924b3', 'Cuscuz com ovo', 5.00, false, false),
('ba9685bf-686d-43eb-9355-7644cf3924b3', 'Cuscuz com carne moída', 8.00, false, false);

-- LANCHES
INSERT INTO items (category_id, name, price, allow_extras, allow_tapioca_molhada) VALUES
('832d8ecf-1aac-49e6-b81d-98314e78ffdf', 'Pão recheado com manteiga', 2.50, true, false),
('832d8ecf-1aac-49e6-b81d-98314e78ffdf', 'Pão recheado com ovo', 4.00, true, false),
('832d8ecf-1aac-49e6-b81d-98314e78ffdf', 'Pão recheado com carne moída', 6.00, true, false),
('832d8ecf-1aac-49e6-b81d-98314e78ffdf', 'Pão recheado com carne assada', 7.00, true, false),
('832d8ecf-1aac-49e6-b81d-98314e78ffdf', 'Pão recheado com linguiça', 5.00, true, false),
('832d8ecf-1aac-49e6-b81d-98314e78ffdf', 'Misto quente', 4.50, true, false),
('832d8ecf-1aac-49e6-b81d-98314e78ffdf', 'Pão na chapa', 2.50, true, false),
('832d8ecf-1aac-49e6-b81d-98314e78ffdf', 'Café puro', 4.00, false, false),
('832d8ecf-1aac-49e6-b81d-98314e78ffdf', 'Café com leite', 5.00, false, false);

-- CALDOS E PANELADA
INSERT INTO items (category_id, name, price, allow_extras, allow_tapioca_molhada) VALUES
('5b809d9d-9492-4afe-9398-dbd907cb026e', 'Caldo de mocotó', 8.00, false, false),
('5b809d9d-9492-4afe-9398-dbd907cb026e', '½ caldo', 6.00, false, false),
('5b809d9d-9492-4afe-9398-dbd907cb026e', 'Caldo de carne moída', 8.00, false, false),
('5b809d9d-9492-4afe-9398-dbd907cb026e', 'Panelada', 10.00, false, false);

-- BEBIDAS
INSERT INTO items (category_id, name, price, allow_extras, allow_tapioca_molhada) VALUES
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Coca lata normal', 5.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Coca lata zero', 5.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Cajuína lata zero', 5.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Água mineral', 2.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Água com gás', 3.50, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Cajuína 600ml (mesa)', 7.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Cajuína 1L', 8.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Coca 1L (mesa)', 8.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Suco goiaba (mesa)', 4.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Suco goiaba (viagem)', 5.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Suco maracujá (mesa)', 4.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Suco maracujá (viagem)', 5.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Suco acerola (mesa)', 4.00, false, false),
('d9e82ae8-0d6c-4441-9c2d-562f87138749', 'Suco acerola (viagem)', 5.00, false, false);

-- PORÇÕES
INSERT INTO items (category_id, name, price, allow_extras, allow_tapioca_molhada) VALUES
('e1f50d12-5910-4b24-83b3-6027901195bb', 'Boi assado', 6.00, false, false),
('e1f50d12-5910-4b24-83b3-6027901195bb', 'Porco assado', 6.00, false, false),
('e1f50d12-5910-4b24-83b3-6027901195bb', 'Frango assado', 5.00, false, false),
('e1f50d12-5910-4b24-83b3-6027901195bb', 'Linguiça assada', 5.00, false, false);

-- ALMOÇO (itens fixos)
INSERT INTO items (category_id, name, price, allow_extras, allow_tapioca_molhada) VALUES
('70078656-659b-4a5d-8abb-48ca2df19ae7', 'Almoço completo', 15.00, true, false),
('70078656-659b-4a5d-8abb-48ca2df19ae7', 'Marmita P', 12.00, true, false),
('70078656-659b-4a5d-8abb-48ca2df19ae7', 'Marmita G', 18.00, true, false);

-- Update lunch_menu (clear and repopulate)
DELETE FROM lunch_menu;
INSERT INTO lunch_menu (weekday, meat_name, meat_price) VALUES
(1, 'Lasanha de frango', 0),
(1, 'Picadinho', 0),
(2, 'Frango ao molho', 0),
(2, 'Carne de sol', 0),
(3, 'Almôndega', 0),
(3, 'Costela', 0),
(4, 'Lasanha de carne', 0),
(4, 'Bife ao molho', 0),
(5, 'Peixe frito', 0),
(5, 'Peixe cozido', 0),
(5, 'Fígado acebolado', 0),
(6, 'Feijoada', 0),
(6, 'Porco frito ou cozido', 0);

-- Clear and insert delivery zones
DELETE FROM delivery_zones;
INSERT INTO delivery_zones (bairro, dist_km, taxa) VALUES
('Centro', 2.0, 5.00),
('Aldeota', 3.0, 6.00),
('Meireles', 4.0, 7.00),
('Fátima', 2.5, 5.50),
('Benfica', 3.5, 6.50),
('Montese', 5.0, 8.00),
('Messejana', 8.0, 12.00),
('Parangaba', 6.0, 10.00);