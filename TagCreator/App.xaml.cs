using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Data;
using gTools.Log;
using System.Threading;
using System.ComponentModel;
using System.Windows.Controls;
using System.Text.RegularExpressions;

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        private Mutex _mutex = null;
        private static DataTypes _dataTypes = new DataTypes();

        public static DataTypes DataTypes 
        {
            get
            {
                return _dataTypes;
            }            
        }

        protected override void OnStartup(StartupEventArgs e)
        {
            Application.Current.DispatcherUnhandledException += Current_DispatcherUnhandledException;

            //allow only one app instance
            if (gTools.Misc.gMisc.IsApplicationRunning("tc_0745", ref _mutex))
            {
                _mutex = null;

                Application.Current.ShutdownMode = ShutdownMode.OnExplicitShutdown;
                Application.Current.Shutdown();

                return;
            }

            GC.KeepAlive(_mutex);

            base.OnStartup(e);
        }

        protected override void OnExit(ExitEventArgs e)
        {
            base.OnExit(e);

            if (_mutex != null)
                _mutex.ReleaseMutex();
        }

        void Current_DispatcherUnhandledException(object sender, System.Windows.Threading.DispatcherUnhandledExceptionEventArgs e)
        {
            gLog.Error(e.Exception.ToString());
        } 
    }

    [ValueConversion(typeof(bool), typeof(bool))]
    public class BoolInvertConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, System.Globalization.CultureInfo culture)
        {
            return !System.Convert.ToBoolean(value);
        }

        public object ConvertBack(object value, Type targetType, object parameter, System.Globalization.CultureInfo culture)
        {
            return true;
        }
    }

    public class DataTypeConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, System.Globalization.CultureInfo culture)
        {
            int id = System.Convert.ToInt32(value);

            var item = App.DataTypes.Where(u => u.Id == id).FirstOrDefault();
            if (item == null)
                return null;

            return item.Name;
        }

        public object ConvertBack(object value, Type targetType, object parameter, System.Globalization.CultureInfo culture)
        {
            return null;
        }
    }

    public class HtmlColorValidationRule : ValidationRule
    {
        public Type ValidationType { get; set; }
        public override ValidationResult Validate(object value, System.Globalization.CultureInfo cultureInfo)
        {
            string strValue = Convert.ToString(value);

            Match m = Regex.Match(strValue, @"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$");
            if (m.Success)
                return new ValidationResult(true, null);
            
            return new ValidationResult(false, "Invalid html color format");            
        }
    }

    public class TreeViewConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, System.Globalization.CultureInfo culture)
        {
            System.Collections.IList collection = (System.Collections.IList)value;
            ListCollectionView view = new ListCollectionView(collection);
            SortDescription sort = new SortDescription(parameter.ToString(), ListSortDirection.Ascending);
            view.SortDescriptions.Add(sort);

            return view;
        }

        public object ConvertBack(object value, Type targetType, object parameter, System.Globalization.CultureInfo culture)
        {
            return null;
        }
    }
}
