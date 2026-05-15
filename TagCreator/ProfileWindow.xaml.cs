using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using MyControls;

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for ProfileNameWindow.xaml
    /// </summary>
    public partial class ProfileWindow : WindowBase
    {
        #region Initialization

        private Profile _profile;
        private static ProfileExportTypes _profileExportTypes = new ProfileExportTypes();
        private static ProfileFormatTypes _profileFormatTypes = new ProfileFormatTypes();
       
        public ProfileWindow()
        {
            InitializeComponent();

            this.DataContext = this;
        }

        #endregion     

        #region Properties

        public Profile Profile
        {
            get
            {
                return _profile;
            }
            set
            {
                _profile = value;
                _profile.NotifyPropertiesChanged();
            }
        }

        public static ProfileExportTypes ProfileExportTypes
        {
            get
            {
                return _profileExportTypes;
            }
        }

        public static ProfileFormatTypes ProfileFormatTypes
        {
            get
            {
                return _profileFormatTypes;
            }
        }

        #endregion

        #region Data binding

        public string ProfileName
        {
            get
            {
                return _profile.Name;
            }
            set
            {
                _profile.Name = value;
                NotifyPropertyChanged("ProfileName");
                NotifyPropertyChanged("IsDataValid");
            }
        }

        public int ProfileExportType
        {
            get
            {
                return _profile.ExportType;
            }
            set
            {
                _profile.ExportType = value;
                NotifyPropertyChanged("IsTabularExportSelected");
            }
        }

        public int ProfileFormatType
        {
            get
            {
                return _profile.FormatType;
            }
            set
            {
                _profile.FormatType = value;
                NotifyPropertyChanged("IsCustomFormatSelected");
            }
        }

        public bool IsDataValid
        {
            get
            {
                return string.IsNullOrEmpty(_profile.Name) == false;
            }
        }

        public bool IsCustomFormatSelected
        {
            get
            {
                return _profile.FormatType == ProfileFormatTypes.Custom;
            }
        }

        public bool IsTabularExportSelected
        {
            get
            {
                return _profile.ExportType == ProfileExportTypes.Tabular;
            }
        }

        #endregion

        #region Events

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {            
            _nameTextBox.Focus();
        }

        private void _applyButton_Click(object sender, RoutedEventArgs e)
        {            
            this.DialogResult = true;
        }

        private void TextBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
                _applyButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        }

        #endregion

    }
}
