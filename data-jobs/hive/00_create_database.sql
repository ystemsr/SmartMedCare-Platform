-- SmartMedCare Hive database bootstrap
CREATE DATABASE IF NOT EXISTS smartmedcare
COMMENT 'SmartMedCare medical and elderly care big data warehouse'
LOCATION '/user/hive/warehouse/smartmedcare.db';

USE smartmedcare;
